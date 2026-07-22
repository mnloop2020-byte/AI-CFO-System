export const DATA_CHANGED_EVENT =
  "ai-cfo:data-changed";

export type DataResource =
  | "customers"
  | "sales"
  | "expenses"
  | "inventory"
  | "invoices"
  | "reports"
  | "documents";

export type DataChangeOperation =
  | "create"
  | "update"
  | "delete";

type DataChangedDetail = {
  resource: DataResource;
  operation: DataChangeOperation;
};

export function notifyDataChanged(
  resource: DataResource,
  operation: DataChangeOperation,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<DataChangedDetail>(
      DATA_CHANGED_EVENT,
      {
        detail: { resource, operation },
      },
    ),
  );
}

export function subscribeToDataChanges(
  resources: readonly DataResource[],
  callback: (detail: DataChangedDetail) => void,
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const watchedResources = new Set(resources);

  const listener = (event: Event) => {
    const detail = (
      event as CustomEvent<DataChangedDetail>
    ).detail;

    if (
      detail &&
      watchedResources.has(detail.resource)
    ) {
      callback(detail);
    }
  };

  window.addEventListener(
    DATA_CHANGED_EVENT,
    listener,
  );

  return () => {
    window.removeEventListener(
      DATA_CHANGED_EVENT,
      listener,
    );
  };
}
