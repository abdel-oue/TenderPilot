"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys } from "@/lib/keys/authKeys";
import { fetchMe, login, logout, signup, startDemo, type User } from "@/lib/api/auth";

export function useMe() {
  return useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
}

function useSessionMutation<TInput>(mutationFn: (input: TInput) => Promise<User | void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (user) => {
      await queryClient.cancelQueries();
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== authKeys.all[0] });
      queryClient.setQueryData(authKeys.me(), user ?? null);
      await queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

export function useLogin() {
  return useSessionMutation(login);
}

export function useSignup() {
  return useSessionMutation(signup);
}

/** Same session handling as a login: it IS one, with an account minted on the spot. */
export function useDemo() {
  return useSessionMutation<void>(() => startDemo());
}

export function useLogout() {
  return useSessionMutation<void>(() => logout());
}
