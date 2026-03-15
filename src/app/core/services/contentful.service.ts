import { Injectable, signal, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { createClient, ClientAPI, Space, Environment, ContentType } from 'contentful-management';
import { ConfigService, UserConfig } from './config';

@Injectable({
  providedIn: 'root'
})
export class ContentfulService {
  private configService = inject(ConfigService);
  private client: ClientAPI | null = null;
  
  public isReady = signal<boolean>(false);
  public spaces = signal<any[]>([]);
  public activeSpace = signal<any | null>(null);
  public activeEnvironment = signal<any | null>(null);
  public contentTypes = signal<any[]>([]);
  public assets = signal<any[]>([]);
  public assetsLoading = signal<boolean>(false);
  public entries = signal<any[]>([]);
  public entriesLoading = signal<boolean>(false);

  constructor() {
    toObservable(this.configService.config).subscribe((configuration: UserConfig | null) => {
      if (configuration?.cmaToken && !this.isReady()) {
        this.initClient(configuration.cmaToken);
      } else if (!configuration?.cmaToken) {
        this.isReady.set(false);
        this.spaces.set([]);
        this.client = null;
      }
    });
  }

  /**
   * Initialize the CMA client with a personal access token.
   * This would typically be pulled from environment variables or User firestore doc.
   */
  initClient(accessToken: string) {
    this.client = createClient({ accessToken });
    this.isReady.set(true);
    this.fetchSpaces();
  }

  async fetchSpaces() {
    if (!this.client) return;
    try {
      const spaceCollection = await this.client.getSpaces();
      this.spaces.set(spaceCollection.items);
      const lastSpaceId = this.configService.config()?.lastSpaceId;
      const spaceExists = spaceCollection.items.some((s: any) => s.sys.id === lastSpaceId);

      // Select last space if it exists, otherwise select the first space by default
      if (spaceCollection.items.length > 0 && !this.activeSpace()) {
        const targetId = spaceExists ? lastSpaceId : spaceCollection.items[0].sys.id;
        if (targetId) {
          await this.selectSpace(targetId);
        }
      }
    } catch (error) {
      console.error('Error fetching Contentful spaces:', error);
    }
  }

  async selectSpace(spaceId: string) {
    if (!this.client) return;
    try {
      const space = await this.client.getSpace(spaceId);
      this.activeSpace.set(space);
      
      // Save choice to Firestore configuration
      this.configService.saveConfig({ lastSpaceId: spaceId }).catch(e => console.error('Failed to save lastSpaceId', e));
      
      // Get the master environment
      const env = await space.getEnvironment('master');
      this.activeEnvironment.set(env);
      
      this.fetchContentModel(env);
      this.fetchAssets(env);
    } catch (error) {
      console.error(`Error selecting space ${spaceId}:`, error);
    }
  }

  async fetchContentModel(environment: any) {
    try {
      const types = await environment.getContentTypes();
      this.contentTypes.set(types.items);
      console.log('Loaded Content Model:', types.items);
    } catch (error) {
      console.error('Error fetching Content Types:', error);
    }
  }

  async executeAction(action: any) {
    const env = this.activeEnvironment();
    if (!env) throw new Error('No active Contentful environment.');

    if (action.intent === 'create') {
      console.log('Creating entry for content type:', action.contentTypeId, 'with fields:', action.fields);
      const entry = await env.createEntry(action.contentTypeId, {
        fields: action.fields
      });
      console.log('Created entry successfully:', entry);
      return entry;
    } else if (action.intent === 'publish') {
      if (!action.entryId) throw new Error('No entryId provided to publish.');
      console.log('Publishing entry:', action.entryId);
      const entry = await env.getEntry(action.entryId);
      const published = await entry.publish();
      console.log('Published entry successfully:', published);
      return published;
    } else if (action.intent === 'unpublish') {
      if (!action.entryId) throw new Error('No entryId provided to unpublish.');
      console.log('Unpublishing entry:', action.entryId);
      const entry = await env.getEntry(action.entryId);
      const unpublished = await entry.unpublish();
      console.log('Unpublished entry successfully:', unpublished);
      return unpublished;
    } else if (action.intent === 'delete') {
      let entryId = action.entryId;
      if (!entryId && action.entryTitle && action.contentTypeId) {
        const found = await this.findEntryByTitle(env, action.contentTypeId, action.entryTitle);
        entryId = found.sys.id;
      }
      if (!entryId) throw new Error('No entryId or entryTitle provided to delete.');
      console.log('Deleting entry:', entryId);
      const entry = await env.getEntry(entryId);
      if (entry.sys.publishedVersion) {
        await entry.unpublish();
      }
      await entry.delete();
      console.log('Entry deleted:', entryId);
      return { deleted: true, entryId };
    } else if (action.intent === 'update') {
      let entry: any;

      if (action.entryId) {
        console.log('Updating entry by ID:', action.entryId);
        entry = await env.getEntry(action.entryId);
      } else if (action.entryTitle && action.contentTypeId) {
        console.log('Resolving entry by title:', action.entryTitle);
        entry = await this.findEntryByTitle(env, action.contentTypeId, action.entryTitle);
      } else {
        throw new Error('Update requires either an entryId or an entryTitle + contentTypeId.');
      }

      // Merge the new fields into the existing entry
      for (const [fieldKey, fieldValue] of Object.entries(action.fields)) {
        entry.fields[fieldKey] = fieldValue;
      }

      console.log('Saving updated entry:', entry.sys.id);
      const updatedEntry = await entry.update();
      console.log('Entry updated successfully:', updatedEntry.sys.id);
      return updatedEntry;

    } else if (action.intent === 'query') {
      console.log('Querying entries for content type:', action.contentTypeId);
      const entries = await env.getEntries({
        content_type: action.contentTypeId,
        limit: 10
      });
      console.log(`Found ${entries.items.length} entries.`);
      return entries.items;

    } else {
      throw new Error(`Unknown intent: ${action.intent}`);
    }
  }

  /**
   * Find an entry by its title within a given content type.
   */
  private async findEntryByTitle(environment: any, contentTypeId: string, title: string): Promise<any> {
    const entries = await environment.getEntries({
      content_type: contentTypeId,
      limit: 100
    });

    // Search through entries for a title field match (case-insensitive)
    const match = entries.items.find((entry: any) => {
      const titleField = entry.fields['title'] || entry.fields['name'] || entry.fields['headline'];
      if (!titleField) return false;
      
      // Check across all locales
      for (const locale of Object.keys(titleField)) {
        if (typeof titleField[locale] === 'string' && 
            titleField[locale].toLowerCase().includes(title.toLowerCase())) {
          return true;
        }
      }
      return false;
    });

    if (!match) {
      throw new Error(`No entry found with title matching "${title}" in content type "${contentTypeId}".`);
    }

    console.log('Resolved entry by title:', match.sys.id, '→', title);
    return match;
  }

  async uploadAsset(file: File): Promise<any> {
    const env = this.activeEnvironment();
    if (!env) throw new Error('No active Contentful environment.');

    console.log('Uploading asset:', file.name);
    
    // Create Asset From Files payload
    const asset = await env.createAssetFromFiles({
      fields: {
        title: {
          'en-US': file.name
        },
        description: {
          'en-US': 'Uploaded via Cypressful AI Assistant'
        },
        file: {
          'en-US': {
            contentType: file.type,
            fileName: file.name,
            file: file
          }
        }
      }
    });

    console.log('Asset created. Processing...');
    // Process the asset
    const processedAsset = await asset.processForAllLocales();
    
    console.log('Asset processed. Publishing...');
    // Publish the asset
    const publishedAsset = await processedAsset.publish();
    
    console.log('Asset published successfully:', publishedAsset);
    return publishedAsset;
  }

  async fetchEntries(contentTypeId?: string, environment?: any) {
    const env = environment || this.activeEnvironment();
    if (!env) return;

    this.entriesLoading.set(true);
    try {
      const query: any = {
        limit: 100,
        order: '-sys.updatedAt' // Notice the minus sign for descending
      };
      if (contentTypeId) {
        query.content_type = contentTypeId;
      }
      const entryCollection = await env.getEntries(query);
      this.entries.set(entryCollection.items);
      console.log(`Loaded ${entryCollection.items.length} entries.`);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      this.entriesLoading.set(false);
    }
  }

  async getEntry(entryId: string) {
    const env = this.activeEnvironment();
    if (!env) throw new Error('No active Contentful environment.');
    return env.getEntry(entryId);
  }

  async publishEntry(entryId: string) {
    const env = this.activeEnvironment();
    if (!env) throw new Error('No active Contentful environment.');
    const entry = await env.getEntry(entryId);
    return entry.publish();
  }

  async unpublishEntry(entryId: string) {
    const env = this.activeEnvironment();
    if (!env) throw new Error('No active Contentful environment.');
    const entry = await env.getEntry(entryId);
    return entry.unpublish();
  }

  async deleteEntry(entryId: string) {
    const env = this.activeEnvironment();
    if (!env) throw new Error('No active Contentful environment.');
    const entry = await env.getEntry(entryId);
    // Unpublish first if published
    if (entry.sys.publishedVersion) {
      await entry.unpublish();
    }
    await entry.delete();
    console.log('Entry deleted:', entryId);
  }

  async getAsset(assetId: string) {
    const env = this.activeEnvironment();
    if (!env) throw new Error('No active Contentful environment.');
    return env.getAsset(assetId);
  }

  async fetchAssets(environment?: any) {
    const env = environment || this.activeEnvironment();
    if (!env) return;

    this.assetsLoading.set(true);
    try {
      const assetCollection = await env.getAssets({ limit: 100, order: '-sys.createdAt' });
      this.assets.set(assetCollection.items);
      console.log(`Loaded ${assetCollection.items.length} assets.`);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      this.assetsLoading.set(false);
    }
  }

  async deleteAsset(assetId: string) {
    const env = this.activeEnvironment();
    if (!env) throw new Error('No active Contentful environment.');

    const asset = await env.getAsset(assetId);
    
    // Unpublish first if published
    if (asset.sys.publishedVersion) {
      await asset.unpublish();
    }
    
    await asset.delete();
    console.log('Asset deleted:', assetId);

    // Refresh the assets list
    this.assets.update(items => items.filter((a: any) => a.sys.id !== assetId));
  }
}
