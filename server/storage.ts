import { type User, type InsertUser, type Topic, type InsertTopic, type ApiKey, type InsertApiKey, users, topics, apiKeys } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";

const DEFAULT_USER_ID = "default";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Topics operations
  getTopics(userId?: string): Promise<Topic[]>;
  getTopic(topicId: string): Promise<Topic | undefined>;
  addTopic(topic: InsertTopic): Promise<Topic>;
  updateTopic(topicId: string, topic: Partial<InsertTopic>): Promise<Topic>;
  deleteTopic(topicId: string): Promise<void>;
  
  // API Keys operations
  getApiKeys(userId?: string): Promise<ApiKey | null>;
  saveApiKeys(keys: InsertApiKey): Promise<ApiKey>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Topics operations
  async getTopics(userId: string = DEFAULT_USER_ID): Promise<Topic[]> {
    try {
      const result = await db.select().from(topics).where(eq(topics.userId, userId));
      return result;
    } catch (error) {
      console.error("Error fetching topics:", error);
      return [];
    }
  }

  async getTopic(topicId: string): Promise<Topic | undefined> {
    try {
      const result = await db.select().from(topics).where(eq(topics.id, topicId));
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error("Error fetching topic:", error);
      return undefined;
    }
  }

  async addTopic(topic: InsertTopic): Promise<Topic> {
    try {
      const result = await db.insert(topics).values(topic).returning();
      return result[0];
    } catch (error) {
      console.error("Error adding topic:", error);
      throw error;
    }
  }

  async updateTopic(topicId: string, updates: Partial<InsertTopic>): Promise<Topic> {
    try {
      const result = await db.update(topics)
        .set(updates)
        .where(eq(topics.id, topicId))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating topic:", error);
      throw error;
    }
  }

  async deleteTopic(topicId: string): Promise<void> {
    try {
      await db.delete(topics).where(eq(topics.id, topicId));
    } catch (error) {
      console.error("Error deleting topic:", error);
      throw error;
    }
  }

  // API Keys operations
  async getApiKeys(userId: string = DEFAULT_USER_ID): Promise<ApiKey | null> {
    try {
      const result = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error("Error fetching API keys:", error);
      return null;
    }
  }

  async saveApiKeys(keys: InsertApiKey): Promise<ApiKey> {
    try {
      const existing = await this.getApiKeys(keys.userId || DEFAULT_USER_ID);
      
      if (existing) {
        // Update existing
        const result = await db.update(apiKeys)
          .set(keys)
          .where(eq(apiKeys.id, existing.id))
          .returning();
        return result[0];
      } else {
        // Insert new
        const result = await db.insert(apiKeys).values(keys).returning();
        return result[0];
      }
    } catch (error) {
      console.error("Error saving API keys:", error);
      throw error;
    }
  }
}

export const storage = new MemStorage();
