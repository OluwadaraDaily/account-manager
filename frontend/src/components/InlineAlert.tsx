import { Icon } from "./Icon";

type InlineAlertProps = {
  message: string;
  onRetry?: () => void;
};

export function InlineAlert({ message, onRetry }: InlineAlertProps) {
  return (
    <div
      role="alert"
      className="border-line bg-paper text-ink flex items-start gap-3 border p-3 text-[12px]"
    >
      <span className="text-moss mt-0.5 shrink-0" aria-hidden="true">
        <Icon name="alert" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Unable to load this section</p>
        <p className="text-muted mt-1 leading-5">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-ink focus-ring mt-2 font-mono text-[10px] font-bold tracking-[0.1em] uppercase underline underline-offset-4"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
