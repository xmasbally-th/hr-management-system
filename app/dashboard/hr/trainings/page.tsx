import { Suspense } from "react";
import HrTrainingsLoading from "./loading";
import Link from "next/link";
import { getAllTrainings } from "@/lib/actions/training-actions";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import { PaginationControls } from "@/components/pagination-controls";
import { HrTrainingsClient } from "./hr-trainings-client";
import { Plus } from "lucide-react";

export const metadata = { title: "จัดการการอบรม (HR)" };

interface HrTrainingsPageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default function HrTrainingsPage({ searchParams }: HrTrainingsPageProps) {
  return (
    <Suspense fallback={<HrTrainingsLoading />}>
      <HrTrainingsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HrTrainingsContent({ searchParams }: HrTrainingsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search ?? "";

  const result = await getAllTrainings({ page, pageSize: 15, search });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">จัดการการอบรม</h1>
          <p className="text-muted-foreground">บันทึกและจัดการประวัติการอบรมของพนักงานทั้งหมด</p>
        </div>
        <Link href="/dashboard/hr/trainings/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มประวัติอบรม
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Suspense>
          <SearchInput placeholder="ค้นหาหลักสูตร/สถานที่..." className="sm:w-64" />
        </Suspense>
      </div>

      <HrTrainingsClient trainings={result.data} />

      <Suspense>
        <PaginationControls
          currentPage={result.page}
          totalCount={result.totalCount}
          pageSize={result.pageSize}
        />
      </Suspense>
    </div>
  );
}
