export interface OpenGraphProps {
  title?: string;
  type?: "book " | "article" | "website" | "profile";
  url?: string;
  image?: string;
  description?: string;
  articlePublishedTime?: Date;
  articleAuthor?: string;
  articleTags?: string[];
}
