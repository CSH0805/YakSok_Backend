const axios = require('axios');
require('dotenv').config();

const KAKAO_LOCAL_API_KEY = process.env.KAKAO_LOCAL_API_KEY;
const KAKAO_LOCAL_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';

/**
 * GET /pharmacy?lat=37.5665&lng=126.9780&radius=1000&size=15
 *
 * lat    : 위도 (필수)
 * lng    : 경도 (필수)
 * radius : 반경 미터 (기본 1000, 최대 20000)
 * size   : 결과 수 (기본 15, 최대 15)
 */
async function getNearbyPharmacies(req, res) {
  const { lat, lng, radius = 1000, size = 15 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      message: '위도(lat)와 경도(lng)는 필수입니다.',
      example: '/pharmacy?lat=37.5665&lng=126.9780&radius=1000',
    });
  }

  const safeRadius = Math.min(parseInt(radius, 10) || 1000, 20000);
  const safeSize   = Math.min(parseInt(size,   10) || 15,   15);

  try {
    const response = await axios.get(KAKAO_LOCAL_URL, {
      headers: {
        Authorization: `KakaoAK ${KAKAO_LOCAL_API_KEY}`,
        KA: 'sdk/2.7.2 os/web lang/ko origin/localhost',
      },
      params: {
        query: '약국',
        category_group_code: 'PM9',  // 약국 카테고리 코드
        x: lng,                       // 카카오는 x=경도, y=위도
        y: lat,
        radius: safeRadius,
        sort: 'distance',             // 거리순 정렬
        size: safeSize,
      },
    });

    const { documents, meta } = response.data;

    if (!documents || documents.length === 0) {
      return res.json({
        success: true,
        data: {
          total: 0,
          radius_m: safeRadius,
          pharmacies: [],
          message: `반경 ${safeRadius}m 내 약국을 찾을 수 없습니다. radius를 늘려보세요.`,
        },
      });
    }

    const pharmacies = documents.map((place, idx) => ({
      rank:       idx + 1,
      name:       place.place_name,
      address:    place.road_address_name || place.address_name,
      phone:      place.phone || '번호 없음',
      distance_m: parseInt(place.distance, 10),
      distance:   formatDistance(parseInt(place.distance, 10)),
      lat:        parseFloat(place.y),
      lng:        parseFloat(place.x),
      kakao_url:  place.place_url,
    }));

    return res.json({
      success: true,
      data: {
        total:       meta.total_count,
        shown:       pharmacies.length,
        radius_m:    safeRadius,
        is_end:      meta.is_end,
        pharmacies,
      },
    });
  } catch (err) {
    console.error('[getNearbyPharmacies 오류]', err.response?.data || err.message);
    return res.status(502).json({
      success: false,
      message: '약국 검색 중 오류가 발생했습니다.',
      error: err.response?.data || err.message,
    });
  }
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

module.exports = { getNearbyPharmacies };
