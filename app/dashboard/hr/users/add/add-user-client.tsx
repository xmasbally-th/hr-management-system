"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUserByAdmin } from "@/lib/actions/user-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@/types/supabase";

export function AddUserClient({ departments, positions }: { departments: { id: string; name: string }[], positions: { id: string; name: string; department_id: string }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    role: "employee" as UserRole,
    departmentId: "none",
    positionId: "none",
  });

  // Filter positions based on selected department
  const filteredPositions = formData.departmentId !== "none"
    ? positions.filter(p => p.department_id === formData.departmentId)
    : [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.fullName || !formData.email) {
      setError("กรุณากรอกชื่อและอีเมลให้ครบถ้วน");
      return;
    }

    startTransition(async () => {
      try {
        await createUserByAdmin({
          fullName: formData.fullName,
          email: formData.email,
          role: formData.role,
          departmentId: formData.departmentId === "none" ? null : formData.departmentId,
          positionId: formData.positionId === "none" ? null : formData.positionId,
        });
        
        // Redirect back to users list on success
        router.push("/dashboard/hr/users");
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message || "เกิดข้อผิดพลาดในการสร้างบัญชี");
        else setError("เกิดข้อผิดพลาดในการสร้างบัญชี");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">ชื่อ-นามสกุล <span className="text-destructive">*</span></Label>
          <Input 
            id="fullName" 
            placeholder="เช่น สมชาย ใจดี" 
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">อีเมลองค์กร <span className="text-destructive">*</span></Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="employee@company.com" 
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label>แผนก</Label>
          <Select 
            value={formData.departmentId} 
            onValueChange={(val) => setFormData({ ...formData, departmentId: val || "none", positionId: "none" })}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="เลือกแผนก..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ไม่ระบุแผนก</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>ตำแหน่ง</Label>
          <Select 
            value={formData.positionId} 
            onValueChange={(val) => setFormData({ ...formData, positionId: val || "none" })}
            disabled={isPending || formData.departmentId === "none"}
          >
            <SelectTrigger>
              <SelectValue placeholder="เลือกตำแหน่ง..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ไม่ระบุตำแหน่ง</SelectItem>
              {filteredPositions.map((pos) => (
                <SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>ระดับสิทธิ์การใช้งาน (Role)</Label>
          <Select 
            value={formData.role} 
            onValueChange={(val) => setFormData({ ...formData, role: val as UserRole })}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="เลือกระดับสิทธิ์..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">พนักงานทั่วไป (Employee)</SelectItem>
              <SelectItem value="manager">ผู้จัดการ (Manager)</SelectItem>
              <SelectItem value="hr">ฝ่ายบุคคล (HR)</SelectItem>
              <SelectItem value="admin">ผู้ดูแลระบบ (Admin)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-4 justify-end pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => router.back()}
          disabled={isPending}
        >
          ยกเลิก
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          บันทึกพนักงานใหม่
        </Button>
      </div>
    </form>
  );
}
