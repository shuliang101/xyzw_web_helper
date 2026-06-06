export const getEquipmentStats = (equipment) => {
  let redCount = 0;
  let holeCount = 0;

  Object.values(equipment || {}).forEach((equ) => {
    Object.values(equ?.quenches || {}).forEach((item) => {
      holeCount++;
      if (item?.colorId == 6) {
        redCount++;
      }
    });
  });

  return { redCount, holeCount };
};

export const getRankHeroEquipmentSummary = (heroObj) => {
  const heroes = Array.isArray(heroObj)
    ? heroObj
    : heroObj && typeof heroObj === "object"
      ? Object.values(heroObj)
      : [];

  let slotCount = 0;
  let redCount = 0;

  heroes.forEach((hero) => {
    Object.values(hero?.equipment || {}).forEach((equ) => {
      Object.values(equ?.quenches || {}).forEach((item) => {
        slotCount++;
        if (item?.colorId == 6) {
          redCount++;
        }
      });
    });
  });

  return {
    slotCount,
    redCount,
    allReturnedSlotsAreRed: slotCount > 0 && slotCount === redCount,
  };
};

export const isRankHoleCountReliable = (heroObj) => {
  return !getRankHeroEquipmentSummary(heroObj).allReturnedSlotsAreRed;
};

export const formatHoleCount = (value, reliable) => {
  return reliable ? value || 0 : "接口未返回";
};
