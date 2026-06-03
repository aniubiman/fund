-- ============================================================
-- 基金模拟盘 — Supabase 数据库建表脚本
-- 在 Supabase SQL Editor 中执行全部内容即可
-- ============================================================

-- 1. 用户资料表
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY,              -- 对应 auth.users.id (匿名登录)
  username   text NOT NULL DEFAULT '',       -- 用户昵称
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. 房间表
CREATE TABLE IF NOT EXISTS public.rooms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code  text UNIQUE NOT NULL,         -- 6位邀请码
  name         text NOT NULL DEFAULT '投资好友房间',
  created_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_count smallint NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 3. 房间成员表
CREATE TABLE IF NOT EXISTS public.room_members (
  room_id   uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- 4. 持仓快照表（每用户每房间只保留最新一条 = upsert）
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  user_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id            uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  username           text NOT NULL DEFAULT '',
  cash               numeric(15,2) NOT NULL DEFAULT 0,
  total_market_value numeric(15,2) NOT NULL DEFAULT 0,
  total_cost         numeric(15,2) NOT NULL DEFAULT 0,
  total_pnl          numeric(15,2) NOT NULL DEFAULT 0,
  total_pnl_pct      numeric(8,2) NOT NULL DEFAULT 0,
  holdings_json      jsonb,                  -- 完整持仓 [{code, name, shares, costNav, nav, mv, pnl, pnlPct}]
  snapped_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, room_id)            -- 每人每房间只存一条
);

-- ============================================================
-- 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_snapshots_room ON public.portfolio_snapshots(room_id, total_pnl_pct DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_invite ON public.rooms(invite_code);

-- ============================================================
-- RLS 策略
-- ============================================================

-- Profiles: 所有人可读，只能改自己
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Rooms: 任何人可读（查邀请码用），只能创建/修改自己的
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY rooms_select ON public.rooms FOR SELECT USING (true);
CREATE POLICY rooms_insert ON public.rooms FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY rooms_update ON public.rooms FOR UPDATE USING (auth.uid() = created_by);

-- Room Members: 能看到同房间的人，只能操作自己
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_members_select ON public.room_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_id AND rm.user_id = auth.uid()));
CREATE POLICY room_members_insert ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY room_members_delete ON public.room_members FOR DELETE USING (auth.uid() = user_id);

-- Snapshots: 同房间成员可互看，只能写自己的
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY snapshots_select ON public.portfolio_snapshots FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.room_members WHERE room_id = portfolio_snapshots.room_id AND user_id = auth.uid()));
CREATE POLICY snapshots_insert ON public.portfolio_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY snapshots_update ON public.portfolio_snapshots FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 触发器：加入/离开房间自动更新 member_count
-- ============================================================
CREATE OR REPLACE FUNCTION update_room_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.rooms SET member_count = member_count + 1 WHERE id = NEW.room_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.rooms SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.room_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_room_member_count ON public.room_members;
CREATE TRIGGER trg_room_member_count
  AFTER INSERT OR DELETE ON public.room_members
  FOR EACH ROW EXECUTE FUNCTION update_room_member_count();
