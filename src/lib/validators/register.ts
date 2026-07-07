import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().min(1, "请输入邮箱").email("邮箱格式无效"),
    password: z.string().min(8, "密码至少 8 位"),
    confirmPassword: z.string().min(1, "请确认密码"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
