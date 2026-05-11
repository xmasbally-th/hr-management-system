import { getEmployeesForSelection } from "@/lib/actions/leave-actions";
import { getTrainingTypes } from "@/lib/training-types";
import { AddTrainingForm } from "./add-training-form";

export const metadata = { title: "เพิ่มประวัติอบรม" };

export default async function AddTrainingPage() {
  const employees = await getEmployeesForSelection();
  const trainingTypes = getTrainingTypes();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">เพิ่มประวัติอบรม</h1>
        <p className="text-muted-foreground">บันทึกประวัติการอบรม/สัมมนาของพนักงาน</p>
      </div>

      <div className="border rounded-lg p-6 bg-card">
        <AddTrainingForm employees={employees} trainingTypes={trainingTypes} />
      </div>
    </div>
  );
}
