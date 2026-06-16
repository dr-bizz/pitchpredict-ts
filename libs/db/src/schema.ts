import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { roleEnum, stageEnum, statusEnum } from './enums';

export { roleEnum, stageEnum, statusEnum };

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').default('player').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  groupName: text('group_name').notNull(),
  flagEmoji: text('flag_emoji').notNull(),
});

export const stadiums = pgTable('stadiums', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  city: text('city').notNull(),
  country: text('country').notNull(),
});

export const fixtures = pgTable(
  'fixtures',
  {
    id: serial('id').primaryKey(),
    homeTeamId: integer('home_team_id')
      .notNull()
      .references(() => teams.id),
    awayTeamId: integer('away_team_id')
      .notNull()
      .references(() => teams.id),
    stadiumId: integer('stadium_id')
      .notNull()
      .references(() => stadiums.id),
    kickoffAt: timestamp('kickoff_at', { withTimezone: true }).notNull(),
    stage: stageEnum('stage').default('group').notNull(),
    status: statusEnum('status').default('scheduled').notNull(),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    kickoffAtIdx: index('fixtures_kickoff_at_idx').on(table.kickoffAt),
  })
);

export const predictions = pgTable(
  'predictions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fixtureId: integer('fixture_id')
      .notNull()
      .references(() => fixtures.id, { onDelete: 'cascade' }),
    homeScore: integer('home_score').notNull(),
    awayScore: integer('away_score').notNull(),
    pointsAwarded: integer('points_awarded'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userFixtureUnique: uniqueIndex('predictions_user_id_fixture_id_unique').on(
      table.userId,
      table.fixtureId
    ),
  })
);

export const championPicks = pgTable('champion_picks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  predictions: many(predictions),
  championPick: one(championPicks),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  homeFixtures: many(fixtures, { relationName: 'homeTeam' }),
  awayFixtures: many(fixtures, { relationName: 'awayTeam' }),
  championPicks: many(championPicks),
}));

export const stadiumsRelations = relations(stadiums, ({ many }) => ({
  fixtures: many(fixtures),
}));

export const fixturesRelations = relations(fixtures, ({ many, one }) => ({
  homeTeam: one(teams, {
    fields: [fixtures.homeTeamId],
    references: [teams.id],
    relationName: 'homeTeam',
  }),
  awayTeam: one(teams, {
    fields: [fixtures.awayTeamId],
    references: [teams.id],
    relationName: 'awayTeam',
  }),
  stadium: one(stadiums, {
    fields: [fixtures.stadiumId],
    references: [stadiums.id],
  }),
  predictions: many(predictions),
}));

export const predictionsRelations = relations(predictions, ({ one }) => ({
  user: one(users, {
    fields: [predictions.userId],
    references: [users.id],
  }),
  fixture: one(fixtures, {
    fields: [predictions.fixtureId],
    references: [fixtures.id],
  }),
}));

export const championPicksRelations = relations(championPicks, ({ one }) => ({
  user: one(users, {
    fields: [championPicks.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [championPicks.teamId],
    references: [teams.id],
  }),
}));
