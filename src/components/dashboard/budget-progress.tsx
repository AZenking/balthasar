"use client";

import { useState } from "react";
import {
  Card,
  Modal,
  NumberField,
  Button,
  Label,
  TagGroup,
  Tag,
  Meter,
} from "@heroui/react";
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
 * 进度条用 HeroUI `Meter`(react-aria 底层,原生 role=meter + ARIA)。
 * 三态着色:normal → success / warning / overspent → danger;Meter 自动
 * clamp value>100 到满格。设置入口用 Modal + NumberField。
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
          yearMonth={yearMonth}
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

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
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

          {/* 进度条:HeroUI Meter(normal→success / warning·overspent→danger) */}
          <Meter
            value={usagePercent}
            minValue={0}
            maxValue={100}
            color={isOverspent || budget.status === "warning" ? "danger" : "success"}
            size="md"
            className="mt-2"
            aria-label={`预算已使用百分之 ${usagePercent}`}
          >
            <Meter.Track>
              <Meter.Fill />
            </Meter.Track>
          </Meter>

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
        yearMonth={yearMonth}
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

/** 预算设置 Modal(¥ 金额主角 + 快捷金额 + 月份上下文)。 */
const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000] as const;

function BudgetSetModal({
  isOpen,
  onOpenChange,
  inputYuan,
  onInputChange,
  onSet,
  isPending,
  onDelete,
  yearMonth,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  inputYuan: string;
  onInputChange: (v: string) => void;
  onSet: () => void;
  isPending: boolean;
  onDelete?: () => void;
  yearMonth: { year: number; month: number };
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <div>
              <Modal.Heading>设置预算</Modal.Heading>
              <p className="text-sm text-muted-foreground">
                {yearMonth.year}年{yearMonth.month}月
              </p>
            </div>
            <Modal.CloseTrigger />
          </Modal.Header>
          <Modal.Body>
            {/* 金额主角区(¥ 前缀 + 大号居中 + surface 高亮) */}
            <NumberField
              value={inputYuan ? parseFloat(inputYuan) : NaN}
              onChange={(v: number) => onInputChange(String(v))}
              step={100}
              minValue={0.01}
              aria-label="预算金额"
              fullWidth
            >
              <Label className="sr-only">预算金额 (元)</Label>
              <NumberField.Group className="h-auto items-center justify-center gap-1 rounded-2xl border-0 bg-[var(--surface)] px-4 py-4 shadow-none">
                <span className="text-3xl font-bold tabular-nums text-muted-foreground">
                  ¥
                </span>
                <NumberField.Input
                  placeholder="0.00"
                  inputMode="decimal"
                  autoFocus
                  className="w-full border-0 bg-transparent p-0 text-center text-3xl font-bold tabular-nums text-foreground shadow-none outline-none focus:ring-0"
                />
              </NumberField.Group>
            </NumberField>

            {/* 快捷金额 —— HeroUI TagGroup(单选,受控于 inputYuan) */}
            <TagGroup
              aria-label="快捷金额"
              selectionMode="single"
              variant="surface"
              size="sm"
              selectedKeys={
                inputYuan && QUICK_AMOUNTS.some((a) => String(a) === inputYuan)
                  ? new Set([inputYuan])
                  : new Set<string>()
              }
              onSelectionChange={(keys) => {
                if (keys === "all") return;
                const next = Array.from(keys)[0];
                if (next != null) onInputChange(String(next));
              }}
            >
              <TagGroup.List className="justify-center">
                {QUICK_AMOUNTS.map((amt) => (
                  <Tag key={String(amt)} id={String(amt)}>
                    ¥{amt.toLocaleString()}
                  </Tag>
                ))}
              </TagGroup.List>
            </TagGroup>
          </Modal.Body>
          <Modal.Footer>
            <div className="flex w-full flex-col gap-2">
              <Button
                variant="primary"
                onPress={onSet}
                isPending={isPending}
                className="w-full"
              >
                保存
              </Button>
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => onOpenChange(false)}
                >
                  取消
                </Button>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={onDelete}
                    className="text-[var(--danger)]"
                  >
                    删除预算
                  </Button>
                )}
              </div>
            </div>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
