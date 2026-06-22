declare module "jsmediatags" {
  interface Tag {
    tags: {
      picture?: {
        data: number[];
        format: string;
      };
      title?: string;
      artist?: string;
      [key: string]: any;
    };
  }
  interface Callbacks {
    onSuccess: (tag: Tag) => void;
    onError: (error: any) => void;
  }
  const jsmediatags: {
    read: (file: File, callbacks: Callbacks) => void;
  };
  export default jsmediatags;
}

declare module "jsmediatags/dist/jsmediatags.min.js" {
  import jsmediatags from "jsmediatags";
  export default jsmediatags;
}