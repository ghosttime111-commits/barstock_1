import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EyeOff, Megaphone, Send } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createAnnouncementFn,
  deactivateAnnouncementFn,
  listAnnouncementsFn,
  listRestaurantNetworksFn,
  listRestaurantsFn,
  markAnnouncementReadFn,
} from "@/lib/barstock.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Сообщения персоналу — BarStock" }] }),
  component: () => (
    <AppShell
      allow={[
        "bartender",
        "kitchen_manager",
        "accountant",
        "manager",
        "bar_manager",
        "super_admin",
      ]}
    >
      <MessagesPage />
    </AppShell>
  ),
});

type Priority = "normal" | "important" | "urgent";
type AudienceChoice = "all_staff" | "restaurant" | "bar_staff" | "bar_restaurant";

function MessagesPage() {
  const { session } = useSession();
  const sessionToken = session?.session_token ?? null;
  const role = session?.user.role;
  const canPublish = role === "bar_manager" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";
  const queryClient = useQueryClient();
  const listAnnouncements = useServerFn(listAnnouncementsFn);
  const listNetworks = useServerFn(listRestaurantNetworksFn);
  const listRestaurants = useServerFn(listRestaurantsFn);
  const markRead = useServerFn(markAnnouncementReadFn);
  const deactivate = useServerFn(deactivateAnnouncementFn);
  const [networkId, setNetworkId] = useState(session?.user.network_id ?? "");

  const { data: networks = [] } = useQuery({
    queryKey: ["restaurant-networks"],
    queryFn: () => listNetworks({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken && isSuperAdmin,
  });
  const { data: restaurants = [] } = useQuery({
    queryKey: ["message-restaurants", networkId],
    queryFn: () =>
      listRestaurants({
        data: {
          session_token: sessionToken!,
          network_id: isSuperAdmin ? networkId || null : null,
        },
      }),
    enabled: !!sessionToken && (!isSuperAdmin || Boolean(networkId)),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["announcements", session?.user.id, networkId],
    queryFn: () =>
      listAnnouncements({
        data: {
          session_token: sessionToken!,
          network_id: isSuperAdmin ? networkId || null : null,
          include_inactive: canPublish,
          limit: 200,
        },
      }),
    enabled: !!sessionToken,
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => markRead({ data: { id, session_token: sessionToken! } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
      await queryClient.invalidateQueries({ queryKey: ["announcements-shell"] });
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivate({ data: { id, session_token: sessionToken! } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
      await queryClient.invalidateQueries({ queryKey: ["announcements-shell"] });
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Megaphone className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">Сообщения персоналу</h1>
          <p className="text-sm text-muted-foreground">
            Объявления и рабочие сообщения для сотрудников сети.
          </p>
        </div>
      </header>

      {isSuperAdmin && (
        <label className="grid max-w-sm gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Сеть</span>
          <select
            value={networkId}
            onChange={(event) => setNetworkId(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Все сети / выберите сеть для публикации</option>
            {networks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {canPublish && (
        <AnnouncementForm
          sessionToken={sessionToken}
          networkId={networkId}
          requireNetwork={isSuperAdmin}
          restaurants={restaurants}
        />
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Не удалось загрузить сообщения"}
        </p>
      )}

      <div className="grid gap-3">
        {data?.announcements.map((announcement) => (
          <article
            key={announcement.id}
            className={`rounded-lg border p-4 ${
              announcement.priority === "urgent"
                ? "border-destructive/50 bg-destructive/5"
                : announcement.priority === "important"
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card"
            }`}
          >
            <button
              type="button"
              className="block w-full text-left"
              onClick={() => {
                if (!announcement.is_read && announcement.is_active) {
                  readMutation.mutate(announcement.id);
                }
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{announcement.title}</h2>
                    {!announcement.is_read && announcement.is_active && <Badge>Новое</Badge>}
                    <PriorityBadge priority={announcement.priority as Priority} />
                    {!announcement.is_active && <Badge variant="secondary">Скрыто</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {announcement.author_name} · {formatDate(announcement.created_at)}
                    {isSuperAdmin ? ` · ${announcement.network_name}` : ""}
                  </p>
                </div>
                <Badge variant="outline">{audienceLabel(announcement)}</Badge>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{announcement.body}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Прочитали: {announcement.read_count} из {announcement.recipient_count}
                </span>
                {announcement.expires_at && (
                  <span>Действует до: {formatDate(announcement.expires_at)}</span>
                )}
              </div>
            </button>
            {announcement.can_deactivate && announcement.is_active && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3"
                disabled={deactivateMutation.isPending}
                onClick={() => {
                  if (window.confirm("Скрыть это сообщение?")) {
                    deactivateMutation.mutate(announcement.id);
                  }
                }}
              >
                <EyeOff className="size-4" />
                Скрыть
              </Button>
            )}
          </article>
        ))}
        {data && data.announcements.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Сообщений пока нет.
          </div>
        )}
      </div>
    </div>
  );
}

function AnnouncementForm({
  sessionToken,
  networkId,
  requireNetwork,
  restaurants,
}: {
  sessionToken: string | null;
  networkId: string;
  requireNetwork: boolean;
  restaurants: Array<{ id: string; name: string }>;
}) {
  const createAnnouncement = useServerFn(createAnnouncementFn);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [audience, setAudience] = useState<AudienceChoice>("all_staff");
  const [restaurantId, setRestaurantId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createAnnouncement({
        data: {
          session_token: sessionToken!,
          network_id: requireNetwork ? networkId || null : null,
          title: title.trim(),
          body: body.trim(),
          priority,
          audience_type: audience === "bar_restaurant" ? "bar_staff" : audience,
          target_restaurant_id:
            audience === "restaurant" || audience === "bar_restaurant" ? restaurantId : null,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
      }),
    onSuccess: async () => {
      setTitle("");
      setBody("");
      setPriority("normal");
      setAudience("all_staff");
      setRestaurantId("");
      setExpiresAt("");
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
      await queryClient.invalidateQueries({ queryKey: ["announcements-shell"] });
    },
  });

  function publish() {
    if (!title.trim() || !body.trim()) return;
    if (requireNetwork && !networkId) return;
    if ((audience === "restaurant" || audience === "bar_restaurant") && !restaurantId) {
      return;
    }
    if (!window.confirm("Опубликовать сообщение для выбранных сотрудников?")) return;
    mutation.mutate();
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Новое сообщение</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Заголовок">
          <Input value={title} maxLength={150} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Важность">
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="normal">Обычное</option>
            <option value="important">Важное</option>
            <option value="urgent">Срочное</option>
          </select>
        </Field>
        <Field label="Получатели">
          <select
            value={audience}
            onChange={(event) => {
              setAudience(event.target.value as AudienceChoice);
              setRestaurantId("");
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all_staff">Весь персонал сети</option>
            <option value="restaurant">Персонал конкретного ресторана</option>
            <option value="bar_staff">Сотрудники бара всей сети</option>
            <option value="bar_restaurant">Сотрудники бара конкретного ресторана</option>
          </select>
        </Field>
        {(audience === "restaurant" || audience === "bar_restaurant") && (
          <Field label="Ресторан">
            <select
              value={restaurantId}
              onChange={(event) => setRestaurantId(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Выберите ресторан</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Срок действия, необязательно">
          <Input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </Field>
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="text-xs text-muted-foreground">Текст сообщения</span>
          <Textarea
            value={body}
            maxLength={5000}
            rows={5}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
      </div>
      <Button type="button" className="mt-4" disabled={mutation.isPending} onClick={publish}>
        <Send className="size-4" />
        {mutation.isPending ? "Публикация…" : "Опубликовать"}
      </Button>
      {mutation.error && (
        <p className="mt-3 text-sm text-destructive">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Не удалось опубликовать сообщение"}
        </p>
      )}
    </section>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "urgent") return <Badge variant="destructive">Срочное</Badge>;
  if (priority === "important") return <Badge>Важное</Badge>;
  return <Badge variant="outline">Обычное</Badge>;
}

function audienceLabel(announcement: {
  audience_type: string;
  target_restaurant_name: string | null;
}) {
  if (announcement.audience_type === "all_staff") return "Весь персонал";
  if (announcement.audience_type === "restaurant") {
    return announcement.target_restaurant_name ?? "Ресторан";
  }
  return announcement.target_restaurant_name
    ? `Бар · ${announcement.target_restaurant_name}`
    : "Сотрудники бара";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
