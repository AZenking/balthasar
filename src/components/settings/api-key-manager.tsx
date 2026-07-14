"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApiKeyManager() {
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys } = trpc.apiKey.list.useQuery();
  const createMutation = trpc.apiKey.create.useMutation({
    onSuccess: (data) => {
      setNewKey(data.plainKey);
      setName("");
      setShowCreate(false);
      utils.apiKey.list.invalidate();
    },
  });
  const revokeMutation = trpc.apiKey.revoke.useMutation({
    onSuccess: () => utils.apiKey.list.invalidate(),
  });

  const activeKeys = (keys ?? []).filter((k) => k.revokedAt === null);
  const revokedKeys = (keys ?? []).filter((k) => k.revokedAt !== null);

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">API Key 管理</h2>
        {!showCreate && (
          <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
            生成 Key
          </Button>
        )}
      </div>

      {newKey && (
        <div className="mb-4 rounded-lg border border-[var(--warning)] bg-[var(--warning)]/10 p-3 text-sm">
          <p className="font-semibold text-[var(--warning)]">⚠️ 请保存你的 API Key (仅显示一次)</p>
          <code className="mt-1 block break-all rounded bg-[var(--surface-secondary)] p-2 text-xs">{newKey}</code>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setNewKey(null)}>
            我已保存
          </Button>
        </div>
      )}

      {showCreate && (
        <div className="mb-4 space-y-2 rounded-lg border bg-muted/30 p-4">
          <Label htmlFor="keyName">Key 名称</Label>
          <Input
            id="keyName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如:浏览器插件"
            maxLength={50}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => createMutation.mutate({ name: name || "默认" })}
              disabled={createMutation.isPending}
            >
              生成
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
              取消
            </Button>
          </div>
        </div>
      )}

      {(activeKeys ?? []).map((k) => (
        <div key={k.id} className="flex items-center justify-between border-b py-2">
          <div>
            <p className="text-sm font-medium">{k.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{k.keyPrefix}...</p>
          </div>
          <button
            onClick={() => {
              if (confirm("确认吊销此 Key?")) revokeMutation.mutate({ id: k.id });
            }}
            className="text-xs text-destructive hover:underline"
          >
            吊销
          </button>
        </div>
      ))}

      {(revokedKeys ?? []).length > 0 && (
        <>
          <p className="mt-3 mb-1 text-xs text-muted-foreground">已吊销</p>
          {(revokedKeys ?? []).map((k) => (
            <div key={k.id} className="flex items-center justify-between border-b py-2 opacity-50">
              <div>
                <p className="text-sm font-medium">{k.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{k.keyPrefix}...</p>
              </div>
              <span className="text-xs text-muted-foreground">已吊销</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
