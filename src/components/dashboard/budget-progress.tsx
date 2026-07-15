"use client";

import { useState } from "react";
import { Card, Modal, NumberField, Button, Label } from "@heroui/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

/**
 * BudgetProgress (027-mobile-home-revamp US5 FR-016..FR-019)。
 *
 * 预算进度区:四态(正常/接近超支 80%/已超支 100%/未设置)。
 * 未设置 → 显示"设置预算"轻量入口(Modal,FR-019)。
 *
 * 设计文档 §3.1-3 + §4.3:已用金额、剩余、使用百分比、时间进度对照。
 *
 * HeroUI v3:无原生 Progress;用 div+rounded-full 自绘进度条(与
 * CategoryTopList 一致)。设置入口用 Modal + NumberField。
 *
 * 数据来源:dashboard.summary.budget(BudgetSummary | null)。
 * null = 查询失败降级(SC-008),显示"预算加载失败 重试"。
 */

function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

type BudgetSummary =
  | { status: "unset" }
  | { status: "normal"; usagePercent: number; remaining: number }
  | { status: "warning"; usagePercent: number; remaining: number }
  | { status: "overspent"; usagePercent: number; overspendAmount: number };

export function BudgetProgress({
  budget,
  monthExpense,
  yearMonth,
}: {
  budget: BudgetSummary | null;
  monthExpense: number;
  yearMonth: { year: number; month: number };
}) {
  const utils = trpc.useUtils();
  const [isSetOpen, setIsSetOpen] = useState(false);
  const [inputYuan, setInputYuan] = useState("");

  const setMutation = trpc.dashboard.budget.set.useMutation({
    onSuccess: () => {
      utils.dashboard.summary.invalidate();
      setIsSetOpen(false);
      setInputYuan("");
      toast.success("预算已设置");
    },
    onError: () => toast.error("设置失败"),
  });

  const deleteMutation = trpc.dashboard.budget.delete.useMutation({
    onSuccess: () => {
      utils.dashboard.summary.invalidate();
      toast.success("已删除预算");
    },
  });

  const handleSet = () => {
    const cents = Math.round(parseFloat(inputYuan) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast.error("请输入有效金额");
      return;
    }
    setMutation.mutate({
      year: yearMonth.year,
      month: yearMonth.month,
      amount: cents,
    });
  };

  // null = 查询失败降级(SC-008)
  if (budget === null) {
    return (
      <section aria-label="预算进度" className="pt-4">
        <Card>
          <Card.Content className="p-4">
            <p className="text-sm text-muted-foreground">预算加载失败</p>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => utils.dashboard.summary.invalidate()}
              className="mt-1"
            >
              重试
            </Button>
          </Card.Content>
        </Card>
      </section>
    );
  }

  // unset → 轻量设置入口(FR-019)
  if (budget.status === "unset") {
    return (
      <section aria-label="预算进度" className="pt-4">
        <Card>
          <Card.Content className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-foreground">本月预算</p>
              <p className="text-xs text-muted-foreground">设置预算,跟踪支出</p>
            </div>
            <Button variant="outline" size="sm" onPress={() => setIsSetOpen(true)}>
              设置预算
            </Button>
          </Card.Content>
        </Card>
        <BudgetSetModal
          isOpen={isSetOpen}
          onOpenChange={setIsSetOpen}
          inputYuan={inputYuan}
          onInputChange={setInputYuan}
          onSet={handleSet}
          isPending={setMutation.isPending}
        />
      </section>
    );
  }

  // normal / warning / overspent
  const isOverspent = budget.status === "overspent";
  const usagePercent = budget.usagePercent;
  // 本月已过百分比(时间进度):当前日 / 当月天数
  const now = new Date();
  const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
  const monthProgressPercent = Math.round((now.getUTCDate() / daysInMonth) * 100);
  const barColor =
    budget.status === "overspent"
      ? "var(--danger)"
      : budget.status === "warning"
        ? "var(--danger)"
        : "var(--success)";
  const fillWidth = Math.min(usagePercent, 100);

  return (
    <section aria-label="预算进度" className="pt-4">
      <Card>
        <Card.Content className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">本月预算</p>
            <Button variant="ghost" size="sm" onPress={() => setIsSetOpen(true)}>
              管理
            </Button>
          </div>

          <div className="mt-2 flex items-center justify-between text-sm">
            <span data-amount>已用 {formatCents(monthExpense)}</span>
            {isOverspent ? (
              <span data-amount className="text-[var(--danger)]">
                超支 {formatCents(budget.overspendAmount)}
              </span>
            ) : (
              <span data-amount className="text-muted-foreground">
                剩余 {formatCents(budget.remaining)}
              </span>
            )}
          </div>

          {/* 进度条(div 自绘,与 CategoryTopList 一致) */}
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--muted)]"
            role="progressbar"
            aria-valuenow={usagePercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`预算已使用百分之 ${usagePercent}`}
          >
            <span
              className="block h-full rounded-full transition-all"
              style={{ width: `${fillWidth}%`, backgroundColor: barColor }}
            />
          </div>

          <p
            className="mt-1 text-xs text-muted-foreground"
          >
            <span>
              本月已过 {monthProgressPercent}% · 预算使用 {usagePercent}%
            </span>
            {budget.status === "warning" && <span className="text-[var(--danger)]"> · 接近超支</span>}
            {isOverspent && <span className="text-[var(--danger)]"> · 已超支</span>}
          </p>
        </Card.Content>
      </Card>

      <BudgetSetModal
        isOpen={isSetOpen}
        onOpenChange={setIsSetOpen}
        inputYuan={inputYuan}
        onInputChange={setInputYuan}
        onSet={handleSet}
        isPending={setMutation.isPending}
        onDelete={() => {
          deleteMutation.mutate({
            year: yearMonth.year,
            month: yearMonth.month,
          });
          setIsSetOpen(false);
        }}
      />
    </section>
  );
}

/** 预算设置 Modal(金额输入 + 设置/删除)。 */
function BudgetSetModal({
  isOpen,
  onOpenChange,
  inputYuan,
  onInputChange,
  onSet,
  isPending,
  onDelete,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  inputYuan: string;
  onInputChange: (v: string) => void;
  onSet: () => void;
  isPending: boolean;
  onDelete?: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Dialog>
        <Modal.Header>
          <Modal.Heading>设置本月预算</Modal.Heading>
          <Modal.CloseTrigger />
        </Modal.Header>
        <Modal.Body>
          <NumberField
            value={inputYuan ? parseFloat(inputYuan) : NaN}
            onChange={(v: number) => onInputChange(String(v))}
            step={100}
            minValue={0.01}
            aria-label="预算金额"
            fullWidth
          >
            <Label>预算金额 (元)</Label>
            <NumberField.Group>
              <NumberField.Input placeholder="0.00" autoFocus />
            </NumberField.Group>
          </NumberField>
        </Modal.Body>
        <Modal.Footer>
          {onDelete && (
            <Button variant="ghost" onPress={onDelete}>
              删除预算
            </Button>
          )}
          <Button variant="ghost" onPress={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="primary" onPress={onSet} isPending={isPending}>
            保存
          </Button>
        </Modal.Footer>
      </Modal.Dialog>
    </Modal>
  );
}
