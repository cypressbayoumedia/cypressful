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

  constructor() {
    toObservable(this.configService.config).subscribe((configuration) => {
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
    } else if (action.intent === 'update') {
      throw new Error('Update intent not fully supported yet by AI assistant.');
    } else if (action.intent === 'query') {
      throw new Error('Query intent not fully supported yet by AI assistant.');
    } else {
      throw new Error(`Unknown intent: ${action.intent}`);
    }
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
}
