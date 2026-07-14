"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormValues } from "@/lib/validators/register";
import { authClient } from "@/server/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BrandHeader } from "@/components/layout/brand-header";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
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
    router.push("/dashboard");
  };

  return (
    <>
      <BrandHeader
        subtitle="10 秒记账,每天坚持。"
        actions={
          <p className="text-sm text-muted-foreground">
            已有账号?{" "}
            <Link href="/login" className="text-primary underline">
              去登录
            </Link>
          </p>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-center">注册</CardTitle>
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
              <Input id="password" type="password" placeholder="至少 8 位" {...register("password")} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input id="confirmPassword" type="password" placeholder="再输入一次" {...register("confirmPassword")} />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>
            {serverError && <p className="text-xs text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "注册中..." : "注册"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
