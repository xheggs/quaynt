import { toast } from 'sonner';

/**
 * Display a success toast. Message should be pre-translated by the caller.
 */
export function showSuccess(message: string) {
  toast.success(message, { duration: 3000 });
}

/**
 * Display an error toast. Message should be pre-translated by the caller.
 */
export function showError(message: string, options?: { description?: string }) {
  toast.error(message, {
    duration: 5000,
    description: options?.description,
  });
}
