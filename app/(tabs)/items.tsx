import React, { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { getItems } from "../../src/db/queries";
import {
  Screen,
  TabHeader,
  Group,
  Row,
  SecondaryButton,
  HeaderButton,
  Actions,
  Text,
} from "../../src/components/ui";
import { Mascot } from "../../src/components/Mascot";
import { colors, type } from "../../src/theme";
import { itemIcon } from "../../src/utils/itemIcon";
import { formatWon } from "../../src/utils/format";
import type { Item } from "../../src/types";

export default function ItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);

  async function load() {
    setItems(await getItems());
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const add = () => router.push("/item-edit");
  const baseCount = items.filter((i) => i.isDefault).length;

  return (
    <Screen
      edges={["top"]}
      header={
        <TabHeader
          title="소지품"
          right={<HeaderButton label="추가" onPress={add} />}
        />
      }
    >
      <View style={styles.summary}>
        <Mascot pose={items.length ? "idle" : "question"} size={76} />
        <View style={{ flex: 1 }}>
          {items.length ? (
            <>
              <Text style={styles.summaryTitle}>
                <Text style={{ color: colors.blue }}>{items.length}개</Text>를
                챙기고 있어요
              </Text>
              <View style={styles.counts}>
                <View style={[styles.count, styles.countBase]}>
                  <Text style={[styles.countText, { color: colors.blue }]}>
                    기본 {baseCount}
                  </Text>
                </View>
                <View style={styles.count}>
                  <Text style={styles.countText}>
                    필요할 때 {items.length - baseCount}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.summaryTitle}>아직 등록한 물건이 없어요</Text>
              <Text style={[type.small, { marginTop: 4 }]}>
                늘 챙기는 물건부터 추가해 보세요
              </Text>
            </>
          )}
        </View>
      </View>
      {items.length > 0 && (
        <Text style={styles.hint}>
          기본 물건은 출발할 때 미리 선택돼요
        </Text>
      )}
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

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 16,
  },
  summaryTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.ink,
  },
  counts: { flexDirection: "row", gap: 6, marginTop: 8 },
  count: {
    minHeight: 26,
    justifyContent: "center",
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: colors.surface,
  },
  countBase: { backgroundColor: colors.tint },
  countText: { fontSize: 12, fontWeight: "600", color: colors.sub },
  hint: { ...type.small, marginTop: 20, marginBottom: 10, marginLeft: 4 },
});
