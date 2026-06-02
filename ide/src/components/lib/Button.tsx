import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import React from "react";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				primary: "bg-brand-600 text-white hover:bg-brand-700",
				secondary:
					"bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
				ghost:
					"hover:bg-zinc-100 text-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-300",
				danger: "bg-red-600 text-white hover:bg-red-700",
				outline:
					"border border-zinc-200 bg-transparent hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
			},
			size: {
				sm: "h-8 px-3 text-sm",
				md: "h-10 px-4 text-sm",
				lg: "h-12 px-6 text-base",
				icon: "h-10 w-10",
			},
		},
		defaultVariants: {
			variant: "primary",
			size: "md",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

export function Button({
	className,
	variant,
	size,
	asChild,
	...props
}: ButtonProps) {
	const Comp = React.ElementType;
	return (
		<button
			className={clsx(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { buttonVariants };
