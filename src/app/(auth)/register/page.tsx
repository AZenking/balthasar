"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import {
  TextField,
  Input as HeroInput,
  Label,
  FieldError,
  Button,
} from "@heroui/react";
import { registerSchema, type RegisterFormValues } from "@/lib/validators/register";
import { authClient } from "@/server/auth/client";

/**
 * 注册页 (027 线稿对齐 + HeroUI v3 原生组合)。
 *
 * 与登录页视觉统一:克制、安全风格。
 * - HeroUI v3 TextField + Label + Input + FieldError
 * - 顶部:返回按钮(→login)+ "安全注册"徽标
 * - 品牌区:灰色圆角图标 + "BALTHASAR"
 * - 邮箱 + 密码(显示/隐藏)+ 确认密码(显示/隐藏)
 * - 主按钮:高对比、52px、rounded-xl、加载 Spinner
 * - 登录入口:"已有账户? 登录"
 */
export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setServerError("");
    const { error } = await authClient.signUpEmail({
      email: data.email,
      password: data.password,
      name: data.email.split("@")[0],
    });
    if (error) {
      if (error.status === 409) {
        setServerError("该邮箱已注册,请直接登录");
      } else {
        setServerError(error.message || "注册失败,请重试");
      }
      return;
    }
    window.location.href = "/dashboard";
  };

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      {/* ── 顶部:返回 + 安全徽标 ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/login")}
          aria-label="返回登录"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--muted)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          安全注册
        </span>
      </div>

      {/* ── 品牌区 ── */}
      <div className="mt-10 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
          <ShieldCheck className="h-8 w-8 text-foreground" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">BALTHASAR</h1>
      </div>

      {/* ── 表单 ── */}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        {/* 邮箱 */}
        <TextField
          fullWidth
          isInvalid={!!errors.email}
          name="email"
          type="email"
          autoComplete="email"
        >
          <Label className="text-sm font-medium">邮箱</Label>
          <HeroInput
            placeholder="you@example.com"
            className="h-[52px] rounded-xl"
            {...register("email")}
          />
          {errors.email && <FieldError>{errors.email.message}</FieldError>}
        </TextField>

        {/* 密码 */}
        <TextField
          fullWidth
          isInvalid={!!errors.password}
          name="password"
          autoComplete="new-password"
        >
          <Label className="text-sm font-medium">密码</Label>
          <div className="relative">
            <HeroInput
              type={showPassword ? "text" : "password"}
              placeholder="至少 8 位"
              className="h-[52px] rounded-xl pr-12"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <FieldError>{errors.password.message}</FieldError>}
        </TextField>

        {/* 确认密码 */}
        <TextField
          fullWidth
          isInvalid={!!errors.confirmPassword}
          name="confirmPassword"
          autoComplete="new-password"
        >
          <Label className="text-sm font-medium">确认密码</Label>
          <div className="relative">
            <HeroInput
              type={showConfirm ? "text" : "password"}
              placeholder="再输入一次"
              className="h-[52px] rounded-xl pr-12"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? "隐藏密码" : "显示密码"}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)]"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <FieldError>{errors.confirmPassword.message}</FieldError>
          )}
        </TextField>

        {/* 服务端错误 */}
        {serverError && (
          <p
            role="alert"
            className="rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]"
          >
            {serverError}
          </p>
        )}

        {/* 主按钮 */}
        <Button
          type="submit"
          variant="primary"
          isPending={isSubmitting}
          className="h-[52px] w-full rounded-xl text-sm font-semibold"
        >
          {isSubmitting ? "注册中..." : "创建账户"}
        </Button>
      </form>

      {/* ── 登录入口 ── */}
      <div className="mt-auto pt-8 text-center text-sm text-muted-foreground">
        已有账户?{" "}
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="font-medium text-[var(--foreground)] underline underline-offset-2"
        >
          登录
        </button>
      </div>
    </div>
  );
}
