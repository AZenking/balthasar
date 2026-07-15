"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import {
  TextField,
  Input as HeroInput,
  Label,
  FieldError,
  Button,
  Spinner,
} from "@heroui/react";
import { loginSchema, type LoginFormValues } from "@/lib/validators/login";
import { authClient } from "@/server/auth/client";
import { cn } from "@/lib/utils";

/**
 * 登录页 (027 线稿对齐 + HeroUI v3 原生组合)。
 *
 * 克制、系统级安全登录风格。仅邮箱 + 密码。
 * - HeroUI v3 TextField + Label + Input + FieldError(非 shadcn 适配层)
 * - 顶部:返回按钮 + "安全登录"徽标
 * - 品牌区:灰色圆角图标 + 标题"登录并同步数据" + 副标题
 * - 邮箱:autocomplete="email"
 * - 密码:显示/隐藏切换 + autocomplete="current-password"
 * - 主按钮:高对比、52px、rounded-xl、加载 Spinner
 * - 注册入口:"还没有账户? 创建账户"
 * - 手机全屏;桌面 ≤420px 居中面板
 */
export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError("");
    const { error } = await authClient.signInEmail({
      email: data.email,
      password: data.password,
    });
    if (error) {
      if (error.status === 423) {
        setServerError("账户已锁定,请稍后重试");
      } else if (error.status === 401) {
        setServerError("邮箱或密码错误");
      } else {
        setServerError(error.message || "登录失败,请重试");
      }
      return;
    }
    window.location.href = "/dashboard";
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/register");
    }
  };

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      {/* ── 顶部:返回 + 安全徽标 ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          aria-label="返回"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--muted)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          安全登录
        </span>
      </div>

      {/* ── 品牌区 ── */}
      <div className="mt-12 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
          <ShieldCheck className="h-8 w-8 text-foreground" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          BALTHASAR
        </h1>
      </div>

      {/* ── 表单(HeroUI v3 TextField 组合) ── */}
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
          autoComplete="current-password"
        >
          <Label className="text-sm font-medium">密码</Label>
          <div className="relative">
            <HeroInput
              type={showPassword ? "text" : "password"}
              placeholder="请输入密码"
              className="h-[52px] rounded-xl pr-12"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)]"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <FieldError>{errors.password.message}</FieldError>
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
          {isSubmitting ? "登录中..." : "登录"}
        </Button>
      </form>

      {/* ── 注册入口 ── */}
      <div className="mt-auto pt-8 text-center text-sm text-muted-foreground">
        还没有账户?{" "}
        <button
          type="button"
          onClick={() => router.push("/register")}
          className="font-medium text-[var(--foreground)] underline underline-offset-2"
        >
          创建账户
        </button>
      </div>
    </div>
  );
}
