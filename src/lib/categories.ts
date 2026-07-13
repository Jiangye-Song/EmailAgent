type CategoryLike = {
  categoryKey: string;
};

export function sortCategoriesWithOtherLast<T extends CategoryLike>(categories: T[]): T[] {
  return [...categories].sort((left, right) => {
    const leftIsOther = left.categoryKey === "other";
    const rightIsOther = right.categoryKey === "other";

    if (leftIsOther === rightIsOther) return 0;
    return leftIsOther ? 1 : -1;
  });
}