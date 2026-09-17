"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys } from "@/lib/keys/authKeys";
import { fetchMe, login, logout, signup, type User } from "@/lib/api/auth";

export function useMe() {
  return useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
}

function useSessionMutation<TInput>(mutationFn: (input: TInput) => Promise<User | void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.all }),
  });
}

export function useLogin() {
  return useSessionMutation(login);
}

export function useSignup() {
  return useSessionMutation(signup);
}

export function useLogout() {
  return useSessionMutation<void>(() => logout());
}
