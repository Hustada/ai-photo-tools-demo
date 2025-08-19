import { createClient } from '@supabase/supabase-js';

// Database types for our tables
export interface PhotoEnhancement {
  id?: string;
  photo_id: string;
  user_id: string;
  ai_description?: string | null;
  accepted_ai_tags: string[];
  suggestion_source?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  content?: string;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. Features requiring database will not work.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper functions for photo enhancements
export const photoEnhancements = {
  // Get enhancement for a photo
  async get(photoId: string): Promise<PhotoEnhancement | null> {
    const { data, error } = await supabase
      .from('photo_enhancements')
      .select('*')
      .eq('photo_id', photoId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching enhancement:', error);
      throw error;
    }
    
    return data;
  },

  // Create or update enhancement
  async upsert(enhancement: PhotoEnhancement): Promise<PhotoEnhancement> {
    const { data, error } = await supabase
      .from('photo_enhancements')
      .upsert(enhancement, {
        onConflict: 'photo_id'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error upserting enhancement:', error);
      throw error;
    }
    
    return data;
  },

  // Delete enhancement
  async delete(photoId: string): Promise<void> {
    const { error } = await supabase
      .from('photo_enhancements')
      .delete()
      .eq('photo_id', photoId);
    
    if (error) {
      console.error('Error deleting enhancement:', error);
      throw error;
    }
  },

  // Get multiple enhancements by photo IDs
  async getBatch(photoIds: string[]): Promise<PhotoEnhancement[]> {
    const { data, error } = await supabase
      .from('photo_enhancements')
      .select('*')
      .in('photo_id', photoIds);
    
    if (error) {
      console.error('Error fetching batch enhancements:', error);
      throw error;
    }
    
    return data || [];
  },

  // Search by tags
  async searchByTags(tags: string[]): Promise<PhotoEnhancement[]> {
    const { data, error } = await supabase
      .from('photo_enhancements')
      .select('*')
      .contains('accepted_ai_tags', tags);
    
    if (error) {
      console.error('Error searching by tags:', error);
      throw error;
    }
    
    return data || [];
  },

  // Get enhancements by user
  async getByUser(userId: string): Promise<PhotoEnhancement[]> {
    const { data, error } = await supabase
      .from('photo_enhancements')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching user enhancements:', error);
      throw error;
    }
    
    return data || [];
  }
};

// Helper functions for blog posts (optional, for future use)
export const blogPosts = {
  async get(id: string): Promise<BlogPost | null> {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching blog post:', error);
      throw error;
    }
    
    return data;
  },

  async upsert(post: BlogPost): Promise<BlogPost> {
    const { data, error } = await supabase
      .from('blog_posts')
      .upsert(post)
      .select()
      .single();
    
    if (error) {
      console.error('Error upserting blog post:', error);
      throw error;
    }
    
    return data;
  },

  async list(limit = 10): Promise<BlogPost[]> {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error listing blog posts:', error);
      throw error;
    }
    
    return data || [];
  }
};