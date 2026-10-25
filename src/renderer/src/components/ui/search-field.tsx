import { Search } from "lucide-react"
import type { InputHTMLAttributes } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string
}

function SearchField({ className, label, name, placeholder = "Tìm kiếm…", ...props }: SearchFieldProps) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <span className="sr-only">{label}</span>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        name={name}
        autoComplete="off"
        placeholder={placeholder}
        className="pl-9"
        {...props}
      />
    </label>
  )
}

export { SearchField }
