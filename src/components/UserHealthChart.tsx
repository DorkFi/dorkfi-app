import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, Users, AlertTriangle, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { getCurrentNetworkConfig } from '@/config';
import algorandService, { AlgorandNetwork } from '@/services/algorandService';
import { APP_SPEC as LendingPoolAppSpec } from '@/clients/DorkFiLendingPoolClient';
import { CONTRACT } from 'ulujs';
import algosdk from 'algosdk';
import BigNumber from 'bignumber.js';

interface UserHealthEvent {
  timestamp: number;
  round: number;
  user_id: string;
  health_factor: number;
  total_collateral_value: number;
  total_borrow_value: number;
}

interface UserHealthChartProps {
  className?: string;
}

const UserHealthChart: React.FC<UserHealthChartProps> = ({ className }) => {
  const [userHealthData, setUserHealthData] = useState<UserHealthEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('trend');

  // Fetch UserHealth events from blockchain
  const fetchUserHealthData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const networkConfig = getCurrentNetworkConfig();
      const clients = algorandService.initializeClients(
        networkConfig.walletNetworkId as AlgorandNetwork
      );
      
      const ci = new CONTRACT(
        Number(networkConfig.contracts.lendingPools[0]),
        clients.algod,
        clients.indexer,
        {
          ...LendingPoolAppSpec.contract,
          events: [
            {
              name: "UserHealth",
              args: [
                { type: "address", name: "user_id" },
                { type: "uint256", name: "health_factor" },
                { type: "uint256", name: "total_collateral_value" },
                { type: "uint256", name: "total_borrow_value" },
              ],
            },
          ],
        },
        {
          addr: algosdk.getApplicationAddress(
            Number(networkConfig.contracts.lendingPools[0])
          ),
          sk: new Uint8Array(),
        }
      );

      const status = await clients.algod.status().do();
      const lastRound = status["last-round"];
      
      const events: any = await ci.getEvents({
        minRound: Math.max(0, lastRound - 2e6), // Last 2M rounds
      });

      const decodeHealthFactor = (event: any[]) => ({
        timestamp: Number(event[2]),
        round: Number(event[1]),
        user_id: String(event[3]),
        health_factor: new BigNumber(event[4]).div(new BigNumber(10).pow(6)).toNumber(), // Convert from micro units
        total_collateral_value: new BigNumber(event[5]).div(new BigNumber(10).pow(12)).toNumber(), // Convert from micro units
        total_borrow_value: new BigNumber(event[6]).div(new BigNumber(10).pow(12)).toNumber(), // Convert from micro units
      });

      const allUserHealthEvents = events
        .find((event: any) => event.name === "UserHealth")
        ?.events?.map(decodeHealthFactor) ?? [];

      // Sort by timestamp for chronological order
      const sortedEvents = allUserHealthEvents.sort((a, b) => a.timestamp - b.timestamp);
      
      setUserHealthData(sortedEvents);
      console.log(`Fetched ${sortedEvents.length} UserHealth events`);
    } catch (err) {
      console.error('Error fetching UserHealth data:', err);
      setError('Failed to fetch UserHealth data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserHealthData();
  }, []);

  // Prepare data for different chart types
  const prepareTrendData = () => {
    // Group by time periods (hourly for recent data)
    const timeGroups = new Map<string, { timestamp: number; avgHealthFactor: number; userCount: number }>();
    
    userHealthData.forEach(event => {
      const hour = new Date(event.timestamp * 1000);
      hour.setMinutes(0, 0, 0); // Round to hour
      const key = hour.getTime().toString();
      
      if (!timeGroups.has(key)) {
        timeGroups.set(key, {
          timestamp: hour.getTime(),
          avgHealthFactor: 0,
          userCount: 0
        });
      }
      
      const group = timeGroups.get(key)!;
      group.avgHealthFactor = (group.avgHealthFactor * group.userCount + event.health_factor) / (group.userCount + 1);
      group.userCount++;
    });
    
    return Array.from(timeGroups.values()).sort((a, b) => a.timestamp - b.timestamp);
  };

  const prepareScatterData = () => {
    // Get latest health data per user
    const latestUserData = new Map<string, UserHealthEvent>();
    
    userHealthData.forEach(event => {
      const existing = latestUserData.get(event.user_id);
      if (!existing || event.timestamp > existing.timestamp) {
        latestUserData.set(event.user_id, event);
      }
    });
    
    return Array.from(latestUserData.values()).map(event => ({
      collateral: event.total_collateral_value,
      borrow: event.total_borrow_value,
      healthFactor: event.health_factor,
      userId: event.user_id.slice(0, 8) + '...', // Truncate for display
    }));
  };

  const prepareDistributionData = () => {
    const latestUserData = new Map<string, UserHealthEvent>();
    
    userHealthData.forEach(event => {
      const existing = latestUserData.get(event.user_id);
      if (!existing || event.timestamp > existing.timestamp) {
        latestUserData.set(event.user_id, event);
      }
    });
    
    const healthRanges = [
      { range: 'Critical (<1.2)', min: 0, max: 1.2, count: 0, color: '#ef4444' },
      { range: 'Risky (1.2-1.5)', min: 1.2, max: 1.5, count: 0, color: '#f97316' },
      { range: 'Moderate (1.5-2.0)', min: 1.5, max: 2.0, count: 0, color: '#eab308' },
      { range: 'Safe (2.0-3.0)', min: 2.0, max: 3.0, count: 0, color: '#22c55e' },
      { range: 'Very Safe (>3.0)', min: 3.0, max: Infinity, count: 0, color: '#10b981' },
    ];
    
    latestUserData.forEach(event => {
      const healthFactor = event.health_factor;
      const range = healthRanges.find(r => healthFactor >= r.min && healthFactor < r.max);
      if (range) {
        range.count++;
      }
    });
    
    return healthRanges.filter(r => r.count > 0);
  };

  const prepareCollateralBorrowData = () => {
    const latestUserData = new Map<string, UserHealthEvent>();
    
    userHealthData.forEach(event => {
      const existing = latestUserData.get(event.user_id);
      if (!existing || event.timestamp > existing.timestamp) {
        latestUserData.set(event.user_id, event);
      }
    });
    
    const ranges = [
      { range: '$0-1K', min: 0, max: 1000, collateral: 0, borrow: 0, users: 0 },
      { range: '$1K-10K', min: 1000, max: 10000, collateral: 0, borrow: 0, users: 0 },
      { range: '$10K-100K', min: 10000, max: 100000, collateral: 0, borrow: 0, users: 0 },
      { range: '$100K-1M', min: 100000, max: 1000000, collateral: 0, borrow: 0, users: 0 },
      { range: '>$1M', min: 1000000, max: Infinity, collateral: 0, borrow: 0, users: 0 },
    ];
    
    latestUserData.forEach(event => {
      const totalValue = event.total_collateral_value + event.total_borrow_value;
      const range = ranges.find(r => totalValue >= r.min && totalValue < r.max);
      if (range) {
        range.collateral += event.total_collateral_value;
        range.borrow += event.total_borrow_value;
        range.users++;
      }
    });
    
    return ranges.filter(r => r.users > 0);
  };

  const trendData = prepareTrendData();
  const scatterData = prepareScatterData();
  const distributionData = prepareDistributionData();
  const collateralBorrowData = prepareCollateralBorrowData();

  const totalUsers = scatterData.length;
  const avgHealthFactor = scatterData.reduce((sum, user) => sum + user.healthFactor, 0) / totalUsers || 0;
  const criticalUsers = distributionData.find(d => d.range.includes('Critical'))?.count || 0;

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <AlertTriangle className="w-8 h-8 text-destructive mb-4" />
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchUserHealthData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            User Health Analytics
          </CardTitle>
          <Button 
            onClick={fetchUserHealthData} 
            variant="outline" 
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Users className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="font-semibold">{totalUsers}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Avg Health Factor</p>
              <p className="font-semibold">{avgHealthFactor.toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Critical Users</p>
              <p className="font-semibold">{criticalUsers}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="trend">Health Trend</TabsTrigger>
            <TabsTrigger value="scatter">Collateral vs Borrow</TabsTrigger>
            <TabsTrigger value="distribution">Health Distribution</TabsTrigger>
            <TabsTrigger value="ranges">Value Ranges</TabsTrigger>
          </TabsList>
          
          <TabsContent value="trend" className="mt-6">
            <ChartContainer
              config={{
                healthFactor: {
                  label: "Health Factor",
                  color: "hsl(var(--chart-1))",
                },
                userCount: {
                  label: "User Count",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-[400px]"
            >
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <ChartTooltip 
                  content={<ChartTooltipContent 
                    formatter={(value, name) => [
                      name === 'healthFactor' ? `${Number(value).toFixed(2)}` : value,
                      name === 'healthFactor' ? 'Avg Health Factor' : 'User Count'
                    ]}
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="avgHealthFactor" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="userCount" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </TabsContent>
          
          <TabsContent value="scatter" className="mt-6">
            <ChartContainer
              config={{
                collateral: {
                  label: "Collateral Value ($)",
                  color: "hsl(var(--chart-1))",
                },
                borrow: {
                  label: "Borrow Value ($)",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-[400px]"
            >
              <ScatterChart data={scatterData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  dataKey="collateral" 
                  name="Collateral Value"
                  scale="log"
                  domain={['dataMin', 'dataMax']}
                />
                <YAxis 
                  type="number" 
                  dataKey="borrow" 
                  name="Borrow Value"
                  scale="log"
                  domain={['dataMin', 'dataMax']}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent 
                    formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name]}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data ? `User: ${data.userId}` : '';
                    }}
                  />}
                />
                <Scatter 
                  dataKey="borrow" 
                  fill="hsl(var(--chart-1))" 
                  fillOpacity={0.6}
                />
              </ScatterChart>
            </ChartContainer>
          </TabsContent>
          
          <TabsContent value="distribution" className="mt-6">
            <ChartContainer
              config={distributionData.reduce((acc, item, index) => ({
                ...acc,
                [item.range]: {
                  label: item.range,
                  color: item.color,
                },
              }), {})}
              className="h-[400px]"
            >
              <PieChart>
                <Pie
                  data={distributionData}
                  dataKey="count"
                  nameKey="range"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  fill="#8884d8"
                  label={({ range, count }) => `${range}: ${count}`}
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ChartContainer>
          </TabsContent>
          
          <TabsContent value="ranges" className="mt-6">
            <ChartContainer
              config={{
                collateral: {
                  label: "Total Collateral ($)",
                  color: "hsl(var(--chart-1))",
                },
                borrow: {
                  label: "Total Borrow ($)",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-[400px]"
            >
              <BarChart data={collateralBorrowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <ChartTooltip 
                  content={<ChartTooltipContent 
                    formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name]}
                  />}
                />
                <Bar dataKey="collateral" fill="hsl(var(--chart-1))" />
                <Bar dataKey="borrow" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ChartContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default UserHealthChart;
