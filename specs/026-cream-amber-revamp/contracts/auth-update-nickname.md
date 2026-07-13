# Contract: auth.updateNickname

**Feature**: 026-cream-amber-revamp | **Procedure**: `auth.updateNickname` | **Type**: tRPC v11 mutation(新增)

**Spec ref**: [spec.md FR-F003 / FR-E002 / FR-E003](../spec.md) | **Data model**: [data-model.md §2.5-2.6](../data-model.md)

> ⚠️ 宪章二禁止手写 OpenAPI/Swagger 契约。tRPC 类型自动派生,本文件仅描述**行为契约**。

## Procedure Signature

```ts
authRouter.updateNickname: protectedProcedure
  .input(z.object({
    displayName: z.string().trim().min(1, '昵称不能为空').max(30, '昵称不超过 30 字符'),
  }))
  .mutation(...)
```

**Auth**: `protectedProcedure`。

## Input Schema

| 字段 | 类型 | 必填 | 校验 | 说明 |
|---|---|---|---|---|
| `displayName` | `string` | 是 | trim 后 `1 ≤ length ≤ 30` | 用户输入的昵称 |

**Zod schema**:
```ts
z.object({
  displayName: z.string()
    .trim()
    .min(1, '昵称不能为空')
    .max(30, '昵称不超过 30 字符'),
})
```

**注意**:zod `trim()` 在解析阶段生效,所以 `'  小明  '` 会被解析为 `'小明'`,长度按 trim 后计算。

## Output Schema

```ts
{
  member: {
    id: string;          // member UUID
    displayName: string; // 更新后的值
  };
}
```

**只返回 member 子集**,不包含 `userId` / `familyId` / `createdAt`(避免信息泄露)。

## Business Rules

1. **目标 member 解析**(server 端):
   ```ts
   const targetMember = await db.query.member.findFirst({
     where: and(
       eq(member.userId, ctx.session.user.id),  // 隔离
     ),
   });
   if (!targetMember) throw new TRPCError({ code: 'NOT_FOUND' });
   ```
   **关键**:通过 `userId === ctx.session.user.id` 定位,**不接受客户端传入 memberId / familyId**。

2. **更新**:
   ```ts
   const [updated] = await db.update(member)
     .set({ displayName: input.displayName })
     .where(eq(member.id, targetMember.id))
     .returning({ id: member.id, displayName: member.displayName });
   return { member: updated };
   ```

3. **无 `updatedAt` 列**:当前 schema 没有 `updatedAt`(见 `src/server/db/schema/member.ts`),Drizzle `$onUpdate` 未配置。本 mutation 不引入 `updatedAt`(零 schema 变更约束);若后续需要审计,作为独立 spec 加列。

4. **幂等性**:同一用户多次更新同一 displayName,SQL UPDATE 仍执行,行级锁短暂持有,无副作用。

5. **缓存失效**(client 端职责,记录在此供 tasks 阶段参考):
   - mutation onSuccess:invalidate `auth.me` query key
   - layout 中问候语组件订阅 `auth.me`,自动 rerender

## Error Scenarios

| 场景 | 行为 |
|---|---|
| 未登录 | `UNAUTHORIZED`(由 protectedProcedure) |
| `displayName` 空字符串或纯空白 | `BAD_REQUEST`,error message `'昵称不能为空'` |
| `displayName` trim 后 > 30 字符 | `BAD_REQUEST`,error message `'昵称不超过 30 字符'` |
| 当前 session 用户在 `members` 表找不到 | `NOT_FOUND`(理论不应发生,除非数据损坏) |
| DB 写入失败 | `INTERNAL_SERVER_ERROR` |

## Test Scenarios(集成测试)

1. **正常更新**:输入 `'  小明  '`,server trim 后存 `'小明'`,返回 `{ member: { id, displayName: '小明' } }`
2. **空字符串**:输入 `''` → `BAD_REQUEST`,`'昵称不能为空'`
3. **纯空白**:输入 `'   '` → trim 后空 → `BAD_REQUEST`
4. **超长**:输入 `'a'.repeat(31)` → `BAD_REQUEST`,`'昵称不超过 30 字符'`
5. **边界长度 30**:输入 `'a'.repeat(30)` → 成功
6. **跨 member 隔离**:User A 调用 mutation,只更新 User A 自己的 member;User B 的 member 不受影响(通过 `userId === ctx.session.user.id` 强制)
7. **跨 family 隔离**:即使用户 A 与用户 B 同家庭,A 不能更新 B 的昵称(`userId` 隔离已覆盖)
8. **中文 / emoji**:输入 `'小明 🎉'`(含 emoji),长度按 JS string length(`.length` = 5),trim 后保留 → 成功
9. **DB 持久化**:更新后重新查 DB,值已写入 `members.display_name` 列

## Security Considerations

- **不允许跨用户修改**:`userId === ctx.session.user.id` 是硬约束,任何尝试传 memberId/familyId 都被忽略(server 只从 session 解析)。
- **XSS 防御**:`displayName` 在前端通过 React 自动转义渲染;后端不做 HTML escape(DB 存原始字符)。
- **速率限制**:本 spec 不引入(spec-015 FR-018 限流 defer 到独立 spec);若未来需要,作为 patch 加 tRPC middleware。
- **审计**:本 mutation **不**写 audit log(宪章三 §审计仅对 Transaction 与 Account 操作强制;member display_name 是低敏感字段)。若后续需要,作为独立 spec 加 `member_events` 表。

## Performance Budget

- **p95 < 300ms**(宪章五 mutation 预算)
- 内部:1 次 SELECT(member.findFirst)+ 1 次 UPDATE;可用单条 UPDATE ... RETURNING 简化(Switch PR 可选优化)
- 索引:`members_user_id_unique_idx`(UNIQUE)保证 `userId` 查询 O(1)
