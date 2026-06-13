// frontend/src/components/ui/UiGallery.js
//
// Dočasná demo stránka na vizuálne overenie dizajnového systému a komponentov.
// Pridaj si ju ako route (napr. /ui) a po overení môžeš zmazať.
//
//   import UiGallery from './components/ui/UiGallery';
//   <Route path="/ui" element={<UiGallery />} />

import React, { useState } from 'react';
import {
  Btn, Card, Tag, MatchStatusTag, RoleChip, Avatar, PtsPill,
  Field, Input, Select, Switch, Check, Segment,
  Dialog, Skeleton, EmptyState, Progress, useToast,
  Leaderboard, LeaderboardRow, StatTile,
} from './index';

const Section = ({ title, children }) => (
  <section style={{ marginBottom: 40 }}>
    <h3 style={{ marginBottom: 16 }}>{title}</h3>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      {children}
    </div>
  </section>
);

const UiGallery = () => {
  const [seg, setSeg] = useState('official');
  const [sw, setSw] = useState(true);
  const [chk, setChk] = useState(false);
  const [dlg, setDlg] = useState(false);
  const toast = useToast();

  return (
    <div className="wrap" style={{ paddingBlock: 40 }}>
      <h1 style={{ marginBottom: 8 }}>UI knižnica</h1>
      <p className="muted" style={{ marginBottom: 32 }}>
        Vizuálne overenie dizajnového systému (Časť A) a komponentov (Časť B).
      </p>

      <Section title="Tlačidlá">
        <Btn variant="primary">Primary</Btn>
        <Btn variant="brand">Brand</Btn>
        <Btn variant="secondary">Secondary</Btn>
        <Btn variant="ghost">Ghost</Btn>
        <Btn variant="danger">Danger</Btn>
        <Btn variant="brand" size="sm">Small</Btn>
        <Btn variant="brand" size="lg">Large</Btn>
      </Section>

      <Section title="Štítky a role">
        <Tag tone="brand">Brand</Tag>
        <Tag tone="success">Success</Tag>
        <Tag tone="live" dot>Live</Tag>
        <MatchStatusTag status="scheduled" />
        <MatchStatusTag status="in_progress" />
        <MatchStatusTag status="finished" />
        <MatchStatusTag status="canceled" />
        <RoleChip role="admin" />
        <RoleChip role="vip" />
        <RoleChip role="player" />
      </Section>

      <Section title="Avatary a body">
        <Avatar size="sm" name="Ján Novák" />
        <Avatar size="md" name="Ján Novák" />
        <Avatar size="lg" name="Ján Novák" ring />
        <PtsPill value={7} />
        <PtsPill value={0} tone="zero" />
        <PtsPill value={10} tone="max" />
      </Section>

      <Section title="Formulár">
        <div style={{ width: 260 }}>
          <Field label="E-mail" hint="Nezdieľame ho">
            <Input type="email" placeholder="ty@email.sk" />
          </Field>
        </div>
        <div style={{ width: 200 }}>
          <Field label="Typ">
            <Select>
              <option>Oficiálna</option>
              <option>Komunitná</option>
            </Select>
          </Field>
        </div>
        <Segment
          options={[
            { value: 'official', label: 'Oficiálne' },
            { value: 'community', label: 'Komunitné' },
          ]}
          value={seg}
          onChange={setSeg}
        />
        <Switch checked={sw} onChange={(e) => setSw(e.target.checked)} />
        <Check checked={chk} onChange={(e) => setChk(e.target.checked)}>Súhlasím</Check>
      </Section>

      <Section title="Karty">
        <Card pad hover style={{ width: 220 }}>
          <b>Hover karta</b>
          <p className="muted">Zdvihne sa pri prejdení.</p>
        </Card>
        <Card pad glow style={{ width: 220 }}>
          <b>Glow karta</b>
          <p className="muted">Brand žiara.</p>
        </Card>
        <Card pad accent style={{ width: 220 }}>
          <b>Accent karta</b>
          <p className="muted">Horný prúžok.</p>
        </Card>
      </Section>

      <Section title="Štatistiky">
        <StatTile label="Body spolu" value="248" tone="brand" delta="+12 tento týždeň" />
        <StatTile label="Presnosť" value="64 %" tone="gold" />
        <StatTile label="Tipov" value="37" />
      </Section>

      <Section title="Rebríček">
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Leaderboard>
            <LeaderboardRow rank={1} name="Peter Tipér" sub="37 tipov" points={248} trend={2} />
            <LeaderboardRow rank={2} name="Jana Hráčka" sub="35 tipov" points={233} trend={-1} me />
            <LeaderboardRow rank={3} name=" Adam Veselý" sub="36 tipov" points={221} trend={0} />
          </Leaderboard>
        </div>
      </Section>

      <Section title="Stavy a feedback">
        <Skeleton width={160} height={20} />
        <div style={{ width: 200 }}><Progress value={64} /></div>
        <div style={{ width: 200 }}><Progress value={40} tone="gold" /></div>
        <Btn variant="brand" onClick={() => setDlg(true)}>Otvor dialóg</Btn>
        <Btn variant="secondary" onClick={() => toast.success('Hotovo', 'Toast funguje.')}>
          Ukáž toast
        </Btn>
      </Section>

      <Section title="Prázdny stav">
        <div style={{ width: '100%' }}>
          <EmptyState
            title="Zatiaľ nič tu nie je"
            message="Keď sa pripojíš do sezóny, objaví sa tu obsah."
          >
            <Btn variant="brand">Objaviť sezóny</Btn>
          </EmptyState>
        </div>
      </Section>

      <Dialog open={dlg} onClose={() => setDlg(false)} title="Ukážkový dialóg">
        <p className="muted" style={{ marginBottom: 18 }}>
          Toto je modálne okno. Klik mimo neho ho zatvorí.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setDlg(false)}>Zrušiť</Btn>
          <Btn variant="primary" onClick={() => setDlg(false)}>Potvrdiť</Btn>
        </div>
      </Dialog>
    </div>
  );
};

export default UiGallery;
