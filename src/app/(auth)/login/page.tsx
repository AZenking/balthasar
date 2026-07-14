"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@/lib/validators/login";
import { authClient } from "@/server/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BrandHeader } from "@/components/layout/brand-header";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
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
    router.push("/dashboard");
  };

  return (
    <>
      <BrandHeader
        subtitle="10 秒记账,每天坚持。"
        actions={
          <p className="text-sm text-muted-foreground">
            还没有账号?{" "}
            <Link href="/register" className="text-primary underline">
              去注册
            </Link>
          </p>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-center">登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" type="password" placeholder="请输入密码" {...register("password")} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            {serverError && <p className="text-xs text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
