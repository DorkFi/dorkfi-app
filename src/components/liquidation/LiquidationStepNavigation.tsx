import React from 'react';
import { Check, Coins, CreditCard, DollarSign } from 'lucide-react';

interface LiquidationStepNavigationProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  completedSteps: number[];
  disabledSteps: number[];
}

const steps = [
  {
    id: 1,
    title: 'Select Collateral',
    icon: Coins,
    description: 'Choose collateral asset'
  },
  {
    id: 2,
    title: 'Select Debt',
    icon: CreditCard,
    description: 'Choose debt to repay'
  },
  {
    id: 3,
    title: 'Enter Amount',
    icon: DollarSign,
    description: 'Enter repayment amount'
  }
];

export default function LiquidationStepNavigation({
  currentStep,
  onStepChange,
  completedSteps,
  disabledSteps
}: LiquidationStepNavigationProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = currentStep === step.id;
        const isDisabled = disabledSteps.includes(step.id);
        const isClickable = !isDisabled && (isCompleted || isCurrent || index === 0);

        return (
          <div key={step.id} className="flex flex-col items-center flex-1">
            {/* Step Circle */}
            <button
              onClick={() => isClickable && onStepChange(step.id)}
              disabled={!isClickable}
              className={`
                w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-200
                ${isCompleted 
                  ? 'bg-green-500 text-white' 
                  : isCurrent 
                    ? 'bg-blue-500 text-white' 
                    : isDisabled
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer'
                }
              `}
            >
              {isCompleted ? (
                <Check className="w-5 h-5" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </button>

            {/* Step Title */}
            <div className="text-center">
              <div className={`
                text-sm font-medium mb-1
                ${isCompleted 
                  ? 'text-green-600 dark:text-green-400' 
                  : isCurrent 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : isDisabled
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-gray-600 dark:text-gray-300'
                }
              `}>
                {step.title}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {step.description}
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className={`
                absolute top-5 left-1/2 w-full h-0.5 -z-10
                ${isCompleted ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
              `} 
              style={{ 
                transform: 'translateX(50%)',
                width: 'calc(100% - 2.5rem)',
                left: 'calc(50% + 1.25rem)'
              }} 
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
