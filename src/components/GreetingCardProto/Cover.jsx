/**
 * Cover.jsx
 * Screen 2: Card Cover (STANDALONE)
 */

import React from 'react';
import cardCoverImg from '../../assets/card/card-cover.jpeg';

const OCCASION_TITLES = {
  birthday: { title: 'Happy Birthday', subtitle: 'On This Very Special Day' },
  anniversary: { title: 'Happy Anniversary', subtitle: 'Celebrating Your Love' },
  holiday: { title: "Season's Greetings", subtitle: 'Warmest Wishes' },
  christmas: { title: 'Merry Christmas', subtitle: 'Joy To You And Yours' },
  newyear: { title: 'Happy New Year', subtitle: 'Cheers To New Beginnings' },
  thanksgiving: { title: 'Happy Thanksgiving', subtitle: 'With Gratitude' },
  valentine: { title: "Happy Valentine's Day", subtitle: 'With All My Love' },
  mothersday: { title: "Happy Mother's Day", subtitle: 'For An Amazing Mom' },
  fathersday: { title: "Happy Father's Day", subtitle: 'For An Incredible Dad' },
  graduation: { title: 'Congratulations', subtitle: 'On Your Achievement' },
  wedding: { title: 'Congratulations', subtitle: 'On Your Special Day' },
  baby: { title: 'Welcome Baby', subtitle: 'A Bundle Of Joy' },
  getwell: { title: 'Get Well Soon', subtitle: 'Thinking Of You' },
  thankyou: { title: 'Thank You', subtitle: 'From The Heart' },
  default: { title: 'Thinking Of You', subtitle: 'A Special Message' }
};

export default function Cover({ occasionKey, onClick }) {
  const occasion = OCCASION_TITLES[occasionKey?.toLowerCase()] || OCCASION_TITLES.default;

  return (
    <div 
      className="gc-cover-wrapper"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Click to open card"
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div 
        className="gc-cover"
        style={{ backgroundImage: `url(${cardCoverImg})` }}
      >
        <div className="gc-cover-content">
          <h1 className="gc-cover-title">{occasion.title}</h1>
          <div className="gc-cover-flourish">
            <span className="gc-flourish-line"></span>
            <span className="gc-flourish-diamond">✦</span>
            <span className="gc-flourish-line"></span>
          </div>
          <p className="gc-cover-subtitle">{occasion.subtitle}</p>
        </div>
      </div>
    </div>
  );
}
