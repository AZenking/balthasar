"use client";

import { useState } from "react";
import { SUPPORTED_CURRENCIES, CURRENCY_MINOR_UNITS } from "@/server/domain/account/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AccountFormValues {
  name: string;
  currency: string;
  type?: "asset" | "debt";
  initialBalanceCents?: number;
}

export function AccountForm({
  mode,
  defaultValues,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  defaultValues?: { name: string; currency: string; type?: "asset" | "debt" };
  onSubmit: (values: AccountFormValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [currency, setCurrency] = useState(defaultValues?.currency ?? "CNY");
  const [type, setType] = useState<"asset" | "debt">(defaultValues?.type ?? "asset");
  const [initialBalance, setInitialBalance] = useState("0");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("账户名称不能为空");
      return;
    }
    if (name.length > 50) {
      setError("账户名称不能超过 50 字");
      return;
    }

    const values: AccountFormValues = { name: name.trim(), currency, type };

    if (mode === "create") {
      const balanceNum = parseFloat(initialBalance);
      if (isNaN(balanceNum) || balanceNum < 0) {
        setError("初始余额无效");
        return;
      }
      const minorUnits = CURRENCY_MINOR_UNITS[currency as keyof typeof CURRENCY_MINOR_UNITS] ?? 2;
      values.initialBalanceCents = Math.round(balanceNum * Math.pow(10, minorUnits));
    }

    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="space-y-1">
        <Label htmlFor={`name-${mode}`}>账户名称</Label>
        <Input
          id={`name-${mode}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如:招商银行卡"
          maxLength={50}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`currency-${mode}`}>币种</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger id={`currency-${mode}`} className="h-10 w-full">
            <SelectValue placeholder="选择币种" />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 027 US6:账户类型(asset 资产 / debt 负债) */}
      <div className="space-y-1">
        <Label htmlFor={`type-${mode}`}>账户类型</Label>
        <Select value={type} onValueChange={(v) => setType(v as "asset" | "debt")}>
          <SelectTrigger id={`type-${mode}`} className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asset">资产(银行卡/现金)</SelectItem>
            <SelectItem value="debt">负债(信用卡/贷款)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "create" && (
        <div className="space-y-1">
          <Label htmlFor={`balance-${mode}`}>初始余额 (元)</Label>
          <Input
            id={`balance-${mode}`}
            type="text"
            inputMode="decimal"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="0.00"
          />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          {mode === "create" ? "创建" : "保存"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  );
}
