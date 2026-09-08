import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
type ToastContextValue = { notify: (message: string) => void };
const Context = createContext<ToastContextValue>({ notify: () => undefined });
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const notify = useCallback((value: string) => {
      setMessage(value);
      window.setTimeout(() => setMessage(""), 2600);
    }, []),
    value = useMemo(() => ({ notify }), [notify]);
  return (
    <Context.Provider value={value}>
      {children}
      {message ? (
        <div className="toast" role="status">
          {message}
        </div>
      ) : null}
    </Context.Provider>
  );
}
export const useToast = () => useContext(Context);
