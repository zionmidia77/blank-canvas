import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      setResolvedUserId(null);
      return;
    }

    setLoading(true);
    setResolvedUserId(null);

    const checkRole = async (attempt = 0) => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (isCancelled) return;

      if (error && attempt < 2) {
        window.setTimeout(() => {
          if (!isCancelled) {
            void checkRole(attempt + 1);
          }
        }, 300 * (attempt + 1));
        return;
      }

      if (error) {
        console.error("Erro ao validar perfil admin", error);
      }

      setIsAdmin(!error && data === true);
      setResolvedUserId(user.id);
      setLoading(false);
    };

    void checkRole();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, user]);

  return {
    isAdmin,
    loading: authLoading || loading || (!!user && resolvedUserId !== user.id),
  };
};
