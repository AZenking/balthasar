import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "请输入邮箱").email("邮箱格式无效"),
  password: z.string().min(1, "请输入密码"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
