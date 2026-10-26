import React, { useState, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { getItems } from "../../src/db/queries";
import {
  Screen,
  TabHeader,
  Intro,
  Group,
  Row,
  SecondaryButton,
  LinkButton,
  Actions,
} from "../../src/components/ui";
import { itemIcon } from "../../src/utils/itemIcon";
import { formatWon } from "../../src/utils/format";
import type { Item } from "../../src/types";

export default function ItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    setItems(await getItems());
  }

  const add = () => router.push("/item-edit");

  return (
    <Screen
      edges={["top"]}
      header={
        <TabHeader
          title="소지품"
          right={<LinkButton label="추가" onPress={add} />}
        />
      }
    >
      <Intro
        title="내가 챙길 물건"
        subtitle={`${items.length}개 등록 · 기본 물건은 출발할 때 미리 선택돼요.`}
      />
      {items.length > 0 && (
        <Group>
          {items.map((item) => (
            <Row
              key={item.id}
              icon={itemIcon(item.name)}
              iconStyle="tile"
              title={item.name}
              subtitle={`${formatWon(item.price)}원 · ${item.isDefault ? "기본 포함" : "필요할 때 추가"}`}
              onPress={() =>
                router.push({ pathname: "/item-edit", params: { id: item.id } })
              }
              chevron
            />
          ))}
        </Group>
      )}
      <Actions>
        <SecondaryButton label="소지품 추가" icon="plus" onPress={add} />
      </Actions>
    </Screen>
  );
}
