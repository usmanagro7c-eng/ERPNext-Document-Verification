import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ label = "Verifying document..." }: { label?: string }) {
  return (
    <Card className="animate-rise shadow-card">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-base font-semibold">{label}</p>
          <p className="text-sm text-muted-foreground">
            Checking the verification code against official records.
          </p>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-9 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
