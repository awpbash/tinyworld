export interface Person {
  id: number;
  name: string;
  aliases: string[];
  description: string;
  birth_date: string | null;
  nationality: string | null;
  occupations: string[];
  image_url: string | null;
  wikipedia_url: string | null;
  wikidata_id: string | null;
  node_type?: string;
  edge_to_next?: {
    relationship_type: string;
    description?: string;
  };
}

export interface Relationship {
  id: number;
  person_a_id: number;
  person_b_id: number;
  relationship_type: string;
  strength: number;
  description: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphNode {
  id: number | string;
  name: string;
  val: number;
  color: string;
  occupations: string[];
  image_url: string | null;
  node_type: string;
  description?: string;
}

export interface GraphLink {
  source: number | string;
  target: number | string;
  relationship_type: string;
  strength: number;
  description: string;
}

export interface SSEEvent {
  type: "status" | "result" | "complete" | "error" | "browser_url" | "graph_update";
  step?: string;
  message?: string;
  data?: any;
  person?: Person;
  streaming_url?: string;
  graph?: GraphData;
}

export interface ConnectionSSEEvent {
  type: "status" | "path_found" | "complete" | "error";
  step?: string;
  message?: string;
  path?: Person[];
  graph?: GraphData;
}

export interface DeepSearchData {
  google_results: number;
  social_profiles: number;
  news_mentions: number;
  has_profile_data: boolean;
}

export interface DeepConnectionData {
  co_mentions: number;
  shared_entities: number;
  event_connections: number;
  mutual_connections: number;
}
