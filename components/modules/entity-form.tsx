"use client";

import { ZodError, ZodSchema } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, Drawer } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

export type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "tags";
  options?: Array<{ label: string; value: string | number }>;
  placeholder?: string;
};

type EntityFormProps<T extends Record<string, unknown>> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldConfig[];
  initial?: Partial<T>;
  schema: ZodSchema;
  onSubmit: (values: T) => Promise<void> | void;
  drawer?: boolean;
  submitLabel?: string;
};

export function EntityForm<T extends Record<string, unknown>>({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial = {},
  schema,
  onSubmit,
  drawer,
  submitLabel = "Save",
}: EntityFormProps<T>) {
  const Shell = drawer ? Drawer : Dialog;

  async function submit(formData: FormData) {
    const raw: Record<string, unknown> = {};
    for (const field of fields) {
      const value = formData.get(field.name)?.toString() ?? "";
      if (field.type === "number") raw[field.name] = value === "" ? 0 : Number(value);
      else if (field.type === "tags") raw[field.name] = value.split(",").map((tag) => tag.trim()).filter(Boolean);
      else if (field.type === "date") raw[field.name] = value || null;
      else raw[field.name] = value;
    }
    try {
      const parsed = schema.parse(raw) as T;
      await onSubmit(parsed);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ZodError) {
        alert(error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
        return;
      }
      throw error;
    }
  }

  return (
    <Shell open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <form action={submit} className="grid gap-4">
        {fields.map((field) => {
          const rawValue = initial[field.name] as string | number | string[] | null | undefined;
          const value = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue ?? "";
          return (
            <div key={field.name} className="grid gap-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.type === "textarea" ? (
                <Textarea id={field.name} name={field.name} defaultValue={String(value)} placeholder={field.placeholder} />
              ) : field.type === "select" ? (
                <Select id={field.name} name={field.name} defaultValue={String(value)}>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={field.name}
                  name={field.name}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  step={field.type === "number" ? "any" : undefined}
                  defaultValue={String(value)}
                  placeholder={field.placeholder}
                />
              )}
            </div>
          );
        })}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Shell>
  );
}
