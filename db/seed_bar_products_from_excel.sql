-- Source: "Сличительная т5 бар 07.06.26..xls", Sheet1, rows 5-141.
-- Columns: B "Продукт", C "Ед.Изм.", H "Цена средняя по приходу".
-- The source has no category column, so every row uses bar category "Без категории".
-- Blank prices are imported as 0.
--
-- This migration never deletes products. Existing bar products are archived first.
-- A referenced product with changed attributes is kept archived, and a new product
-- is inserted so historical inventory_items keep their original product metadata.

begin;

create temp table bar_products_seed (
  source_order integer primary key,
  name text not null,
  unit text not null,
  unit_price numeric not null check (unit_price >= 0),
  category_name text not null
) on commit drop;

insert into bar_products_seed (
  source_order,
  name,
  unit,
  unit_price,
  category_name
)
values
  (1, 'Альбумин', 'кг', 100, 'Без категории'),
  (2, 'Бамбук (листья маринованные)', 'кг', 41.33, 'Без категории'),
  (3, 'Вермут "Мартини белый"', 'кг', 40, 'Без категории'),
  (4, 'Вермут "Мартини красный"', 'кг', 0, 'Без категории'),
  (5, 'Вермут "Мартини Фиеро"', 'кг', 43, 'Без категории'),
  (6, 'Винный напиток Лилле Розе', 'кг', 32.75, 'Без категории'),
  (7, 'Вино Abtei Himmerod Riesling', 'кг', 38.83, 'Без категории'),
  (8, 'Вино Alumia Reserva', 'кг', 35.05, 'Без категории'),
  (9, 'Вино Brancott Estate Malborough Sauvignon Blanc бел/сух', 'кг', 35.37, 'Без категории'),
  (10, 'Вино Chapel White бел. п/сух. 0,75л', 'кг', 23.39, 'Без категории'),
  (11, 'Вино Domodo Amabile кр.п/сух', 'кг', 25.52, 'Без категории'),
  (12, 'Вино Dulong Bordeaux кр.сух. 0,75л', 'кг', 37.23, 'Без категории'),
  (13, 'Вино Fantini Montepulciano кр.п/сух', 'кг', 0, 'Без категории'),
  (14, 'Вино Gato Negro 9 Lives кр.сух', 'кг', 34.52, 'Без категории'),
  (15, 'Вино Gold Country Rose роз.п/сух', 'кг', 33.19, 'Без категории'),
  (16, 'Вино Golden Kaan Pinotage (полусухое, ЮАР)', 'кг', 31.28, 'Без категории'),
  (17, 'Вино Hans Baer Gewurztraminer белое полусухое', 'кг', 29.53, 'Без категории'),
  (18, 'Вино Hans Baer Riesling белое сухое', 'кг', 29.53, 'Без категории'),
  (19, 'Вино House Wine RED', 'кг', 20.92, 'Без категории'),
  (20, 'Вино House wine ROSE', 'кг', 20.92, 'Без категории'),
  (21, 'Вино House Wine WHITE', 'кг', 20.92, 'Без категории'),
  (22, 'Вино Idi Di Marzo Rosato роз.сух', 'кг', 34.03, 'Без категории'),
  (23, 'Вино Konigsmosel Riesling бел. п/слад.', 'кг', 0, 'Без категории'),
  (24, 'Вино Marius by M.Chapoutier бел.сух', 'кг', 0, 'Без категории'),
  (25, 'Вино Mucho Mas бел сух, 0,75', 'кг', 32.47, 'Без категории'),
  (26, 'Вино Rocca Pinot Grigio', 'кг', 30.91, 'Без категории'),
  (27, 'Вино Tamada Pirosmani (бел.полусладкое)', 'кг', 24.57, 'Без категории'),
  (28, 'Вино Tamada Pirosmani (кр. полусладкое)', 'кг', 28.15, 'Без категории'),
  (29, 'Вино Trapiche Malbec кр.сух.', 'кг', 0, 'Без категории'),
  (30, 'Вино К.В. Темпранильо крас.сух.', 'кг', 30.01, 'Без категории'),
  (31, 'Вино Пино Фран кр п/сух пачка', 'кг', 7.5, 'Без категории'),
  (32, 'Вино Портвейн Sandeman Tawny кр. креп.', 'кг', 67, 'Без категории'),
  (33, 'Вино Пулье Лукарелли красное сухое', 'кг', 35.73, 'Без категории'),
  (34, 'Вино Шардоне бел п/сух пачка', 'кг', 7.5, 'Без категории'),
  (35, 'Виски Glenmorangie 10 YO', 'кг', 0, 'Без категории'),
  (36, 'Виски Jim Beam', 'кг', 50.42, 'Без категории'),
  (37, 'Виски Баллантайнс Файнест', 'кг', 61.2, 'Без категории'),
  (38, 'Виски Джеймсон 3 года', 'кг', 78.31, 'Без категории'),
  (39, 'Виски Чивас Ригал', 'кг', 0, 'Без категории'),
  (40, 'Вода Your Water негаз, 0,5', 'кг', 1.5, 'Без категории'),
  (41, 'Вода Аква Минерале газир.(бут)', 'кг', 1.07, 'Без категории'),
  (42, 'Вода мин. Боржоми 0,33 л', 'кг', 2.75, 'Без категории'),
  (43, 'Водка Danzka', 'кг', 48.78, 'Без категории'),
  (44, 'Водка Абсолют', 'кг', 58, 'Без категории'),
  (45, 'Водка Бульбашъ №1', 'кг', 35.96, 'Без категории'),
  (46, 'Водка Бульбашъ №1 Клюквенная', 'кг', 35.96, 'Без категории'),
  (47, 'Водка Бульбашъ Особая', 'кг', 19.96, 'Без категории'),
  (48, 'Джин Гордонс', 'кг', 51.2, 'Без категории'),
  (49, 'Игристое вино Ганча Асти белое сладкое', 'кг', 61.7, 'Без категории'),
  (50, 'Игристое вино Контарини Просекко белое брют, 0.75', 'кг', 39.87, 'Без категории'),
  (51, 'Какао шоколадный', 'кг', 24.9, 'Без категории'),
  (52, 'Кег Аливария', 'кг', 0, 'Без категории'),
  (53, 'Кег Лидское пиво', 'кг', 0, 'Без категории'),
  (54, 'Концентрат лимонный', 'кг', 18.23, 'Без категории'),
  (55, 'Коньяк Айк 7 лет', 'кг', 61.08, 'Без категории'),
  (56, 'Коньяк Ани', 'кг', 77.16, 'Без категории'),
  (57, 'Коньяк Арарат Априкот со вкусом абрикоса', 'кг', 68.5, 'Без категории'),
  (58, 'Коньяк Арарат со вкусом вишни', 'кг', 68.5, 'Без категории'),
  (59, 'Коньяк Арарат со вкусом кофе', 'кг', 68.5, 'Без категории'),
  (60, 'Коньяк Мартель VS***', 'кг', 0, 'Без категории'),
  (61, 'Коньяк Месхети', 'кг', 41.1, 'Без категории'),
  (62, 'Кордиал баланс Вкус бузина-персик', 'кг', 0, 'Без категории'),
  (63, 'Кордиал баланс Вкус Зеленое яблоко-виноград', 'кг', 28.8, 'Без категории'),
  (64, 'Кордиал баланс Вкус клубника-фейхоа', 'кг', 28.8, 'Без категории'),
  (65, 'Кордиал баланс Вкус мята-ежевика', 'кг', 28.8, 'Без категории'),
  (66, 'Кордиал баланс Вкус попкорн-абрикос', 'кг', 28, 'Без категории'),
  (67, 'Кордиал баланс Вкус фисташка-киви', 'кг', 28.8, 'Без категории'),
  (68, 'Кофе в зернах', 'кг', 67.99, 'Без категории'),
  (69, 'Ликер Апероль', 'кг', 50.84, 'Без категории'),
  (70, 'Ликер Егермейстер', 'кг', 65.5, 'Без категории'),
  (71, 'Ликер Кампари АПЕРИТИВ', 'кг', 68.75, 'Без категории'),
  (72, 'Ликер Карловарска Бехеровка', 'кг', 63.03, 'Без категории'),
  (73, 'Ликер Куантро', 'кг', 72.9, 'Без категории'),
  (74, 'Морс Клюква', 'кг', 3.32, 'Без категории'),
  (75, 'Напиток Миринда', 'кг', 2.24, 'Без категории'),
  (76, 'Напиток Пепси Max', 'кг', 2.24, 'Без категории'),
  (77, 'Напиток Пепси-кола', 'кг', 2.24, 'Без категории'),
  (78, 'Напиток Ред Булл', 'кг', 15.68, 'Без категории'),
  (79, 'Напиток Севен АП Zero', 'кг', 2.24, 'Без категории'),
  (80, 'Напиток Эвервесс тоник', 'кг', 3.56, 'Без категории'),
  (81, 'Настойка Вишневая', 'кг', 16.67, 'Без категории'),
  (82, 'Настойка Парэчкавая (смородиновая)', 'кг', 22.42, 'Без категории'),
  (83, 'Пиво Bud Б/А бут', 'кг', 2.65, 'Без категории'),
  (84, 'Пиво Grimbergen светлое КЕГ', 'кг', 8.45, 'Без категории'),
  (85, 'Пиво Grimbergen темное КЕГ', 'кг', 8.45, 'Без категории'),
  (86, 'Пиво Paulaner алкогольное, 0.5', 'кг', 5.66, 'Без категории'),
  (87, 'Пиво Szalon Б/А бут', 'кг', 3.98, 'Без категории'),
  (88, 'Пиво Вечер в Брюгге, бут 0.5', 'кг', 2.26, 'Без категории'),
  (89, 'Пиво Корона Экстра бут 0,355', 'кг', 4.6, 'Без категории'),
  (90, 'Пиво Лидское безалкогольное, 0.5', 'кг', 1.7, 'Без категории'),
  (91, 'Пиво Лидское Премиум светлое КЕГ', 'кг', 2.88, 'Без категории'),
  (92, 'Пиво Лидское Пшеничное светлое нефильтр. КЕГ', 'кг', 2.72, 'Без категории'),
  (93, 'Пюре Ананас/Облепиха', 'кг', 25.22, 'Без категории'),
  (94, 'Пюре Личи', 'кг', 45.9, 'Без категории'),
  (95, 'Пюре Халва-Ваниль', 'кг', 25.22, 'Без категории'),
  (96, 'Ром Havana Club Cuban Spiced', 'кг', 67.71, 'Без категории'),
  (97, 'Ром Гавана Клуб Аньехо 3 года', 'кг', 52.03, 'Без категории'),
  (98, 'Ром Гавана Клуб Эспесиаль', 'кг', 0, 'Без категории'),
  (99, 'Сахар в пакет 4 гр.', 'кг', 0.02, 'Без категории'),
  (100, 'Сироп Ваниль', 'кг', 27.99, 'Без категории'),
  (101, 'Сироп Гренадин', 'кг', 27.99, 'Без категории'),
  (102, 'Сироп Земляника', 'кг', 37.8, 'Без категории'),
  (103, 'Сироп Карамель (без сахара)', 'кг', 34.06, 'Без категории'),
  (104, 'Сироп Кокос', 'кг', 27.99, 'Без категории'),
  (105, 'Сироп Маракуйя', 'кг', 27.99, 'Без категории'),
  (106, 'Сироп Миндаль', 'кг', 0, 'Без категории'),
  (107, 'Сироп Оранж Шприц', 'кг', 37.8, 'Без категории'),
  (108, 'Сироп Попкорн', 'кг', 0, 'Без категории'),
  (109, 'Сироп Розовый грейпфрут', 'кг', 37.8, 'Без категории'),
  (110, 'Сироп Сангрия', 'кг', 0, 'Без категории'),
  (111, 'Сироп Солёная карамель', 'кг', 37.8, 'Без категории'),
  (112, 'Сироп Цветы бузины', 'кг', 0, 'Без категории'),
  (113, 'Смесь для глинтвейна', 'кг', 97.3, 'Без категории'),
  (114, 'Сок Ананасовый', 'кг', 3.46, 'Без категории'),
  (115, 'Сок апельсиновый', 'кг', 3.87, 'Без категории'),
  (116, 'Сок виноградный', 'кг', 3.46, 'Без категории'),
  (117, 'Сок вишневый', 'кг', 3.2, 'Без категории'),
  (118, 'Сок грейпфрутовый', 'кг', 0, 'Без категории'),
  (119, 'Сок томатный', 'кг', 3.2, 'Без категории'),
  (120, 'Сок яблочный', 'кг', 3.2, 'Без категории'),
  (121, 'Соус Манго', 'кг', 45.9, 'Без категории'),
  (122, 'Текила Lunazul Blanco', 'кг', 79.77, 'Без категории'),
  (123, 'Текила Lunazul Reposado', 'кг', 0, 'Без категории'),
  (124, 'Чай Гавайский микс', 'кг', 151, 'Без категории'),
  (125, 'Чай Жареный ананас', 'кг', 0, 'Без категории'),
  (126, 'Чай зеленый жасминовый', 'кг', 97, 'Без категории'),
  (127, 'Чай зеленый Матча', 'кг', 0, 'Без категории'),
  (128, 'Чай зеленый Серебристые иглы', 'кг', 97, 'Без категории'),
  (129, 'Чай Манго/цитрус', 'кг', 158, 'Без категории'),
  (130, 'Чай Ройбуш Йогурт-черника', 'кг', 151, 'Без категории'),
  (131, 'Чай травяной Швейцарский напиток', 'кг', 141, 'Без категории'),
  (132, 'Чай черный Английский завтрак', 'кг', 97, 'Без категории'),
  (133, 'Чай черный Легенда Англии', 'кг', 97, 'Без категории'),
  (134, 'Шампанское Советское брют', 'кг', 11.75, 'Без категории'),
  (135, 'Шампанское Советское п/сладкое', 'кг', 11.75, 'Без категории'),
  (136, 'Шампанское Советское п/сух', 'кг', 11.75, 'Без категории'),
  (137, 'Шарики "поппинг боба"', 'кг', 22.04, 'Без категории');

do $$
begin
  if exists (
    select 1
    from bar_products_seed
    group by lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    having count(*) > 1
  ) then
    raise exception 'Excel seed contains duplicate product names';
  end if;
end
$$;

insert into public.categories (name, area)
select distinct seed.category_name, 'bar'
from bar_products_seed as seed
where not exists (
  select 1
  from public.categories as category
  where category.area = 'bar'
    and lower(regexp_replace(btrim(category.name), '[[:space:]]+', ' ', 'g'))
      = lower(regexp_replace(btrim(seed.category_name), '[[:space:]]+', ' ', 'g'))
);

create temp table bar_product_matches (
  source_order integer primary key,
  product_id uuid
) on commit drop;

insert into bar_product_matches (source_order, product_id)
select
  seed.source_order,
  coalesce(
    (
      select product.id
      from public.products as product
      where product.area = 'bar'
        and product.name = seed.name
        and product.unit = seed.unit
        and coalesce(product.unit_price, 0) = seed.unit_price
        and exists (
          select 1
          from public.categories as category
          where category.id = product.category_id
            and category.area = 'bar'
            and category.name = seed.category_name
        )
      order by
        case product.status
          when 'approved' then 0
          when 'pending' then 1
          else 2
        end,
        product.id::text
      limit 1
    ),
    (
      select product.id
      from public.products as product
      where product.area = 'bar'
        and lower(regexp_replace(btrim(product.name), '[[:space:]]+', ' ', 'g'))
          = lower(regexp_replace(btrim(seed.name), '[[:space:]]+', ' ', 'g'))
        and not exists (
          select 1
          from public.inventory_items as inventory_item
          where inventory_item.product_id = product.id
        )
      order by
        case product.status
          when 'approved' then 0
          when 'pending' then 1
          else 2
        end,
        product.id::text
      limit 1
    )
  ) as product_id
from bar_products_seed as seed;

update public.products
set status = 'archived'
where area = 'bar'
  and status is distinct from 'archived';

update public.products as product
set
  name = seed.name,
  unit = seed.unit,
  unit_price = seed.unit_price,
  category_id = (
    select category.id
    from public.categories as category
    where category.area = 'bar'
      and lower(regexp_replace(btrim(category.name), '[[:space:]]+', ' ', 'g'))
        = lower(regexp_replace(btrim(seed.category_name), '[[:space:]]+', ' ', 'g'))
    order by category.id::text
    limit 1
  ),
  area = 'bar',
  status = 'approved'
from bar_products_seed as seed
join bar_product_matches as match
  on match.source_order = seed.source_order
where product.id = match.product_id;

insert into public.products (
  name,
  category_id,
  unit,
  status,
  unit_price,
  area
)
select
  seed.name,
  (
    select category.id
    from public.categories as category
    where category.area = 'bar'
      and lower(regexp_replace(btrim(category.name), '[[:space:]]+', ' ', 'g'))
        = lower(regexp_replace(btrim(seed.category_name), '[[:space:]]+', ' ', 'g'))
    order by category.id::text
    limit 1
  ),
  seed.unit,
  'approved',
  seed.unit_price,
  'bar'
from bar_products_seed as seed
join bar_product_matches as match
  on match.source_order = seed.source_order
where match.product_id is null;

select
  (select count(*) from bar_products_seed) as excel_products,
  (select count(distinct category_name) from bar_products_seed) as excel_categories,
  (
    select count(*)
    from public.products as product
    where product.area = 'bar'
      and product.status = 'approved'
      and exists (
        select 1
        from bar_products_seed as seed
        where lower(regexp_replace(btrim(seed.name), '[[:space:]]+', ' ', 'g'))
          = lower(regexp_replace(btrim(product.name), '[[:space:]]+', ' ', 'g'))
      )
  ) as active_imported_products;

commit;

