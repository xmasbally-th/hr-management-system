"use client";

import { useState, useTransition } from "react";
import { createDepartment, createPosition, deleteDepartment, deletePosition } from "@/lib/actions/master-data-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Loader2 } from "lucide-react";

export function MasterDataClient({ initialDepartments, initialPositions }: { initialDepartments: { id: string; name: string; description?: string | null }[], initialPositions: { id: string; name: string; department?: { name: string } | null; department_id: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"departments" | "positions">("departments");

  // Dept Form
  const [deptName, setDeptName] = useState("");
  const [deptDesc, setDeptDesc] = useState("");

  // Pos Form
  const [posName, setPosName] = useState("");
  const [posDeptId, setPosDeptId] = useState("");

  function handleAddDept(e: React.FormEvent) {
    e.preventDefault();
    if (!deptName) return;
    startTransition(async () => {
      try {
        await createDepartment(deptName, deptDesc);
        setDeptName("");
        setDeptDesc("");
      } catch (err: unknown) {
        if (err instanceof Error) alert(err.message);
      }
    });
  }

  function handleAddPos(e: React.FormEvent) {
    e.preventDefault();
    if (!posName || !posDeptId) return;
    startTransition(async () => {
      try {
        await createPosition(posName, posDeptId);
        setPosName("");
        setPosDeptId("");
      } catch (err: unknown) {
        if (err instanceof Error) alert(err.message);
      }
    });
  }

  function handleDeleteDept(id: string) {
    if (!confirm("ยืนยันการลบแผนกนี้?")) return;
    startTransition(async () => {
      try {
        await deleteDepartment(id);
      } catch (err: unknown) {
        if (err instanceof Error) alert(err.message);
      }
    });
  }

  function handleDeletePos(id: string) {
    if (!confirm("ยืนยันการลบตำแหน่งนี้?")) return;
    startTransition(async () => {
      try {
        await deletePosition(id);
      } catch (err: unknown) {
        if (err instanceof Error) alert(err.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b">
        <button
          className={`pb-2 px-1 border-b-2 transition-colors ${activeTab === "departments" ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("departments")}
        >
          จัดการแผนก (Departments)
        </button>
        <button
          className={`pb-2 px-1 border-b-2 transition-colors ${activeTab === "positions" ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("positions")}
        >
          จัดการตำแหน่ง (Positions)
        </button>
      </div>

      {activeTab === "departments" && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 border rounded-lg p-4 bg-card h-fit">
            <h3 className="font-semibold mb-4 text-lg">เพิ่มแผนกใหม่</h3>
            <form onSubmit={handleAddDept} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deptName">ชื่อแผนก</Label>
                <Input id="deptName" value={deptName} onChange={(e) => setDeptName(e.target.value)} required disabled={isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deptDesc">รายละเอียด (ถ้ามี)</Label>
                <Input id="deptDesc" value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} disabled={isPending} />
              </div>
              <Button type="submit" className="w-full" disabled={isPending || !deptName}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                เพิ่มแผนก
              </Button>
            </form>
          </div>
          
          <div className="md:col-span-2 border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>ชื่อแผนก</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialDepartments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="text-muted-foreground">{dept.description || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDept(dept.id)} disabled={isPending} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {initialDepartments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">ไม่มีข้อมูลแผนก</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeTab === "positions" && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 border rounded-lg p-4 bg-card h-fit">
            <h3 className="font-semibold mb-4 text-lg">เพิ่มตำแหน่งใหม่</h3>
            <form onSubmit={handleAddPos} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="posName">ชื่อตำแหน่ง</Label>
                <Input id="posName" value={posName} onChange={(e) => setPosName(e.target.value)} required disabled={isPending} />
              </div>
              <div className="space-y-2">
                <Label>สังกัดแผนก</Label>
                <Select value={posDeptId} onValueChange={(val) => setPosDeptId(val || "")} disabled={isPending}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกแผนก..." />
                  </SelectTrigger>
                  <SelectContent>
                    {initialDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={isPending || !posName || !posDeptId}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                เพิ่มตำแหน่ง
              </Button>
            </form>
          </div>
          
          <div className="md:col-span-2 border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>ชื่อตำแหน่ง</TableHead>
                  <TableHead>สังกัดแผนก</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialPositions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell className="font-medium">{pos.name}</TableCell>
                    <TableCell className="text-muted-foreground">{pos.department?.name || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDeletePos(pos.id)} disabled={isPending} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {initialPositions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">ไม่มีข้อมูลตำแหน่ง</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
