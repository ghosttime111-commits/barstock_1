import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { u as useRouter } from "../_libs/tanstack__react-router.mjs";
import { m as isRedirect } from "../_libs/tanstack__router-core.mjs";
import { S as Slot } from "../_libs/radix-ui__react-slot.mjs";
import { c as cva } from "../_libs/class-variance-authority.mjs";
import { c as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { a as createServerFn, T as TSS_SERVER_FUNCTION, g as getServerFnById } from "./server-B-fI4YJN.mjs";
import { s as stringType, n as numberType, b as booleanType, a as arrayType, o as objectType, e as enumType } from "../_libs/zod.mjs";
function useServerFn(serverFn) {
  const router = useRouter();
  return reactExports.useCallback(async (...args) => {
    try {
      const res = await serverFn(...args);
      if (isRedirect(res)) throw res;
      return res;
    } catch (err) {
      if (isRedirect(err)) {
        err.options._fromLocation = router.stores.location.get();
        return router.navigate(router.resolveRedirect(err).options);
      }
      throw err;
    }
  }, [router, serverFn]);
}
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
const Button = reactExports.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Comp, { className: cn(buttonVariants({ variant, size, className })), ref, ...props });
  }
);
Button.displayName = "Button";
var createSsrRpc = (functionId) => {
  const url = "/_serverFn/" + functionId;
  const serverFnMeta = { id: functionId };
  const fn = async (...args) => {
    return (await getServerFnById(functionId))(...args);
  };
  return Object.assign(fn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};
const idSchema = objectType({
  id: stringType().uuid()
});
const sessionSchema = objectType({
  session_token: stringType().min(32).max(2048)
});
const productUnitSchema = enumType(["л", "кг", "шт", "бут"]);
const productStatusSchema = enumType(["approved", "pending", "archived"]);
const moneySchema = numberType().min(0).max(1e6);
const inventoryEntryTypeSchema = enumType(["add", "set"]);
const loginFn = createServerFn({
  method: "POST"
}).inputValidator((input) => objectType({
  login: stringType().min(1).max(120),
  password: stringType().min(1).max(200)
}).parse(input)).handler(createSsrRpc("28a8d70050c42d28343de998b458253a1cc39e87791d2aff4f34559a633907fa"));
const currentSessionFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.parse(input)).handler(createSsrRpc("4c3054a4c581398a90f98d9bfe064ba85d1b9f9cafd25ae4a6637fa4e1648fb7"));
const listRestaurantsFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.parse(input)).handler(createSsrRpc("6b8777e599c3e44fd6892de7ce7d6a77476cfe303fd0a2c7d9c5491890212d89"));
const createRestaurantFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  name: stringType().trim().min(1).max(160)
}).parse(input)).handler(createSsrRpc("d19fedc8da2a6716bb4c8f6ebedd3e0503667715c5ca88e81d39d36ddb4109ac"));
const listBartendersFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.parse(input)).handler(createSsrRpc("3872da7760fede97169c893c112c8841d0772877c596b11c0d281c95dfbcd4d0"));
const createBartenderFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  name: stringType().trim().min(1).max(160),
  login: stringType().trim().min(1).max(120),
  password: stringType().min(6).max(200),
  restaurant_id: stringType().uuid()
}).parse(input)).handler(createSsrRpc("d7d2d3ae529b2726155ccd7968978de146442052be24027412b4a0d270ec0a4a"));
const deleteBartenderFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(createSsrRpc("e0a2021f31cb14a3635cb9144998e7adf149efd1b550fd7a8f343b17d8d26ef6"));
const updateBartenderRestaurantFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  id: stringType().uuid(),
  restaurant_id: stringType().uuid()
}).parse(input)).handler(createSsrRpc("31ab4ff1ed51ddae6c6250152c1362aa05a0e84c4d6fc71a921b4489a8aaa03b"));
const deleteRestaurantFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(createSsrRpc("2f8343c58ec82e662486993840fcfe54670861373086e866b40e85fae1b6118b"));
const listCategoriesFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.parse(input)).handler(createSsrRpc("39b9915fc50c4e205f8ba3d1ea553bf69fdaa9959fe77960e4badb2c3e0e58e6"));
const createCategoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  name: stringType().trim().min(1).max(160)
}).parse(input)).handler(createSsrRpc("812e0f6a53b09ddf26c7779de1cbd8f7f142fcafa0f06c6547b142c793bde5e7"));
const updateCategoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  id: stringType().uuid(),
  name: stringType().trim().min(1).max(160)
}).parse(input)).handler(createSsrRpc("0f3a5c56d8ec9fc9112e02ac12cd2ded40bc59f3f658d412c4a68d82985bf07a"));
const deleteCategoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(createSsrRpc("b7f383bacd4c25fb6d7039e363c5dc7667a3adf6a2f932ba0d4b7d1fcb18601b"));
const listProductsFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.parse(input)).handler(createSsrRpc("e828ea5540d9b7fde089901de6e26903caf03d2d4f3bffe932f372f7a619afad"));
const createProductFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  name: stringType().trim().min(1).max(200),
  category_id: stringType().uuid(),
  unit: productUnitSchema,
  status: productStatusSchema.default("approved"),
  unit_price: moneySchema.default(0)
}).parse(input)).handler(createSsrRpc("cc149b014e351603c81e43e66c9fffef1957edd2972687867580fe349d0dbd16"));
const updateProductFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  id: stringType().uuid(),
  name: stringType().trim().min(1).max(200),
  category_id: stringType().uuid(),
  unit: productUnitSchema,
  status: productStatusSchema,
  unit_price: moneySchema
}).parse(input)).handler(createSsrRpc("fe46b218a09d31b6db7c65268ab84911f538008263d1bd018774e4cc64733faf"));
const archiveProductFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(createSsrRpc("2210c7275d29f1e36c09a57d185a92ddf01de92a1b1fd901744b159ea7184bbc"));
const deleteProductFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(createSsrRpc("5cd8c0b34cc855caabeafe7e9ea8aacde0512f8d533d1962bd159c4f33885b7b"));
const listInventoriesFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  restaurant_id: stringType().uuid().optional()
}).parse(input)).handler(createSsrRpc("a1680a4dd17d890f330c5861ac967436f9926e765a2688a245446bd6234ac72b"));
const createInventoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  restaurant_id: stringType().uuid().optional()
}).parse(input)).handler(createSsrRpc("06966c5b910e848ae37fa095345b22fa3bafabc28b34eedebe8ab1ff6761b2f2"));
const getInventoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(createSsrRpc("ba086f8b7adf9a6f8fcca41533177ac5ff52297b6785cc9d4a76ecb451b61326"));
const getInventoryEntriesFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  inventory_id: stringType().uuid(),
  product_id: stringType().uuid()
}).parse(input)).handler(createSsrRpc("981f2468946cb7215ba7e483496aedaca4a20a91f74e45c795702aad848e8c70"));
const upsertItemFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  inventory_id: stringType().uuid(),
  product_id: stringType().uuid(),
  quantity: numberType().min(0).max(1e6),
  entry_type: inventoryEntryTypeSchema.default("set")
}).parse(input)).handler(createSsrRpc("f5eb5399f13447825e98da7150ae3353e440165a4207a6fa89a6b79057a56482"));
const closeInventoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(createSsrRpc("c182782f0a5b50a810a44c1985aebc44e77bd55a32358d9a2f42348a1f461526"));
createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  inventory_id: stringType().uuid(),
  amount: numberType(),
  comment: stringType().min(1).max(500)
}).parse(input)).handler(createSsrRpc("73435ff690c97b1613261c2bced090ad441a0df7586ccbcc1c1bb23b10030d12"));
const listClosedInventoriesFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  restaurant_id: stringType().uuid().nullable().optional()
}).parse(input)).handler(createSsrRpc("eb469f7c88a1aefe33911af5821c8d55aba974c753495230a8ea69e50536cdb0"));
const deleteInventoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(createSsrRpc("881691b44cbd7c032ea63f2962d858bc7c03338509b29ee98744916b34e7dfe8"));
const requestInventoryCorrectionFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).extend({
  correction_comment: stringType().trim().min(1).max(1e3)
}).parse(input)).handler(createSsrRpc("2f6def3949bb8b39bc8e3f1fa1101cd5ad867fbc9ce2baefa99b743fb31284c7"));
const getInventoryReportFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(createSsrRpc("19773996e586c53314eec0ac66f347406a103d10aedcfdcf4a6e046d964f1913"));
const getMonthlyArchiveFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  month: stringType().regex(/^\d{4}-\d{2}$/),
  restaurant_id: stringType().uuid().nullable().optional()
}).parse(input)).handler(createSsrRpc("e6e307219fdc6cb3d248148372f4dd315403b976e113b752e69978f77ab2a98c"));
const listExpectedFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(createSsrRpc("33a6d8e0f3abd65538c3c8c7cf1a8661fe9aea2cbd655f74633c67696b86085a"));
const upsertExpectedFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  inventory_id: stringType().uuid(),
  product_id: stringType().uuid(),
  quantity: numberType().min(0).max(1e6)
}).parse(input)).handler(createSsrRpc("9bd4e14599148af33c8d0b51435bb2b13111fc07d77122e7f231c828ac398121"));
const bulkSetExpectedFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  inventory_id: stringType().uuid(),
  items: arrayType(objectType({
    product_id: stringType().uuid(),
    quantity: numberType().min(0).max(1e6)
  })).min(1).max(5e3),
  replace: booleanType().optional()
}).parse(input)).handler(createSsrRpc("8ba55f84cbd660174f7e3602ee61d495fe4d776c96e73e6b9b3c5bfc569bddf8"));
export {
  getInventoryFn as A,
  Button as B,
  getInventoryEntriesFn as C,
  upsertItemFn as D,
  closeInventoryFn as E,
  listExpectedFn as F,
  upsertExpectedFn as G,
  bulkSetExpectedFn as H,
  currentSessionFn as I,
  listRestaurantsFn as a,
  createRestaurantFn as b,
  cn as c,
  listBartendersFn as d,
  createBartenderFn as e,
  deleteBartenderFn as f,
  deleteRestaurantFn as g,
  updateBartenderRestaurantFn as h,
  listCategoriesFn as i,
  createCategoryFn as j,
  updateCategoryFn as k,
  loginFn as l,
  deleteCategoryFn as m,
  listProductsFn as n,
  createProductFn as o,
  updateProductFn as p,
  archiveProductFn as q,
  deleteProductFn as r,
  listClosedInventoriesFn as s,
  getMonthlyArchiveFn as t,
  useServerFn as u,
  listInventoriesFn as v,
  createInventoryFn as w,
  getInventoryReportFn as x,
  deleteInventoryFn as y,
  requestInventoryCorrectionFn as z
};
