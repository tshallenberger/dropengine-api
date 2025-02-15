import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Jimp from "jimp";
@Injectable()
export class AzureStorageService {
  constructor(private readonly config: ConfigService) {}

  public async uploadFile(
    container_name: string,
    blob_name: string,
    data: any
  ) {
    // Enter your storage account name and shared key
    const account =
      this.config.get("AZURE_STORAGE_ACCOUNT_NAME") ||
      this.config.get("AZURE_STORAGE_ACCOUNT");
    const accountKey = this.config.get("AZURE_STORAGE_SAS_KEY");

    // Use StorageSharedKeyCredential with storage account and account key
    // StorageSharedKeyCredential is only available in Node.js runtime, not in browsers
    const sharedKeyCredential = new StorageSharedKeyCredential(
      account,
      accountKey
    );

    const blobServiceClient = new BlobServiceClient(
      // When using AnonymousCredential, following url should include a valid SAS or support public access
      `https://${account}.blob.core.windows.net`,
      sharedKeyCredential
    );

    const containerClient =
      blobServiceClient.getContainerClient(container_name);

    // Create a blob
    var content = data;

    if (blob_name.includes("png")) {
      content = await (
        await Jimp.read(content).then((img) => img.resize(256, 256).quality(70))
      ).getBufferAsync(Jimp.MIME_PNG);
    }

    const blob = containerClient.getBlockBlobClient(blob_name);
    const upload_response = await blob.upload(
      content,
      Buffer.byteLength(content)
    );
    return { upload_response, blob };
  }
}
