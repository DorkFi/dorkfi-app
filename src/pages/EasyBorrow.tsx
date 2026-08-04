import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BorrowCard from "@/components/easy-borrow/BorrowCard";
import { H1, Body } from "@/components/ui/Typography";

interface EasyBorrowPageProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

const EasyBorrowPage = ({ activeTab, onTabChange }: EasyBorrowPageProps) => {
  const pageCopy =
    "Borrow WAD or USDC in one flow — without picking markets by hand.";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header activeTab={activeTab} onTabChange={onTabChange} />
      <main className="flex-1 container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-lg mx-auto mb-6 sm:mb-8 text-center sm:text-left">
          <H1 className="text-3xl sm:text-4xl tracking-tight">Borrow</H1>
          <Body className="mt-2 text-muted-foreground">{pageCopy}</Body>
        </div>
        <BorrowCard />
      </main>
      <Footer />
    </div>
  );
};

export default EasyBorrowPage;
