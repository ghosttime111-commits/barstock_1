export const CATEGORY_DUPLICATE_MESSAGE =
  "Категория с таким названием уже существует в выбранной сети и зоне";

const CATEGORY_CREATE_ERROR = "Не удалось создать категорию";
const CATEGORY_UPDATE_ERROR = "Не удалось обновить категорию";

type CategoryMutationAction = "create" | "update";

function postgresErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

export function toSafeCategoryMutationError(error: unknown, action: CategoryMutationAction) {
  if (postgresErrorCode(error) === "23505") {
    return new Error(CATEGORY_DUPLICATE_MESSAGE);
  }

  return new Error(action === "create" ? CATEGORY_CREATE_ERROR : CATEGORY_UPDATE_ERROR);
}
