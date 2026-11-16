import { useCallback, useEffect, useState } from "react";
import {
  createCollectionApi,
  createSubsectionApi,
  deleteCollectionApi,
  deleteDocumentApi,
  deleteSubsectionApi,
  errorMessage,
  fetchCollectionsApi,
  fetchDocumentsApi,
  renameCollectionApi,
  renameSubsectionApi,
  uploadDocumentsApi,
} from "../lib/api";
import type { CollectionRecord, DocumentRecord, UploadDocumentsResponse } from "../lib/types";

export function useLibraryStore(onTopicsChanged?: () => void) {
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [defaultCollectionId, setDefaultCollectionId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedSubsectionId, setSelectedSubsectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const refreshLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const [colRes, docsRes] = await Promise.all([fetchCollectionsApi(), fetchDocumentsApi()]);
      setCollections(colRes.collections);
      setDefaultCollectionId(colRes.default_collection_id);
      setDocuments(docsRes);
      setBackendError(null);
    } catch (e) {
      setBackendError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const createCollection = useCallback(
    async (name: string) => {
      const created = await createCollectionApi(name);
      await refreshLibrary();
      return created;
    },
    [refreshLibrary]
  );

  const renameCollection = useCallback(
    async (id: string, name: string) => {
      const updated = await renameCollectionApi(id, name);
      await refreshLibrary();
      return updated;
    },
    [refreshLibrary]
  );

  const deleteCollection = useCallback(
    async (id: string, mode: "delete_all" | "move_to_default") => {
      const res = await deleteCollectionApi(id, mode);
      if (selectedCollectionId === id) {
        setSelectedCollectionId(null);
        setSelectedSubsectionId(null);
      }
      await refreshLibrary();
      onTopicsChanged?.();
      return res;
    },
    [refreshLibrary, selectedCollectionId, onTopicsChanged]
  );

  const createSubsection = useCallback(
    async (collectionId: string, name: string) => {
      const sub = await createSubsectionApi(collectionId, name);
      await refreshLibrary();
      return sub;
    },
    [refreshLibrary]
  );

  const renameSubsection = useCallback(
    async (subsectionId: string, name: string) => {
      const sub = await renameSubsectionApi(subsectionId, name);
      await refreshLibrary();
      return sub;
    },
    [refreshLibrary]
  );

  const deleteSubsection = useCallback(
    async (subsectionId: string, deleteDocuments = false) => {
      const res = await deleteSubsectionApi(subsectionId, deleteDocuments);
      if (selectedSubsectionId === subsectionId) {
        setSelectedSubsectionId(null);
      }
      await refreshLibrary();
      onTopicsChanged?.();
      return res;
    },
    [refreshLibrary, selectedSubsectionId, onTopicsChanged]
  );

  const uploadDocuments = useCallback(
    async (
      files: File[],
      options?: {
        collectionId?: string | null;
        subsectionId?: string | null;
        onProgress?: (pct: number) => void;
      }
    ): Promise<UploadDocumentsResponse> => {
      const res = await uploadDocumentsApi(files, options);
      await refreshLibrary();
      onTopicsChanged?.();
      return res;
    },
    [refreshLibrary, onTopicsChanged]
  );

  const deleteDocument = useCallback(
    async (docId: number) => {
      const res = await deleteDocumentApi(docId);
      await refreshLibrary();
      onTopicsChanged?.();
      return res;
    },
    [refreshLibrary, onTopicsChanged]
  );

  const selectScope = useCallback((collectionId: string | null, subsectionId: string | null = null) => {
    setSelectedCollectionId(collectionId);
    setSelectedSubsectionId(subsectionId);
  }, []);

  return {
    collections,
    defaultCollectionId,
    documents,
    selectedCollectionId,
    selectedSubsectionId,
    loading,
    backendError,
    refreshLibrary,
    selectScope,
    createCollection,
    renameCollection,
    deleteCollection,
    createSubsection,
    renameSubsection,
    deleteSubsection,
    uploadDocuments,
    deleteDocument,
  };
}
