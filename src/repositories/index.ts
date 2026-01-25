import { IndexedDbAssetFileStore } from './local/IndexedDbAssetFileStore'
import {
  LocalAssetRepository,
  LocalFolderRepository,
  LocalSubjectRepository,
  LocalTopicRepository,
} from './local/LocalRepositories'

export const subjectRepo = new LocalSubjectRepository()
export const topicRepo = new LocalTopicRepository()
export const folderRepo = new LocalFolderRepository()
export const assetRepo = new LocalAssetRepository()
export const assetFileStore = new IndexedDbAssetFileStore()

