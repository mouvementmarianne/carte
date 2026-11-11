<?php
/**
 * Template Name: Carte Interactive
 */
get_header();
?>

<style>
  .content-wrap {
    max-width: min(90vw, 1440px);
    margin: 0 auto;
    padding: 0 max(16px, 5.75vw);
  }
	
  .leaflet-popup-content-wrapper {
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .leaflet-popup-content {
    width: auto;
    min-width: 260px;
    min-height: 40px;
    max-height: 60vh;
    overflow: auto;
	  margin: 0;
    resize: both;
  }

  .popup-info {
    padding: 14px 16px;
    color: #333;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
  }

  .popup-info h2 {
    margin: 0 0 10px;
    font-size: 16px;
    color: #1a1a1a;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 6px;
    text-align: center;
  }

  .popup-info p {
    margin: 6px 0;
    overflow-wrap: break-word;
  }

  .popup-info p strong {
    color: #555;
  }

  .popup-info p span {
    display: block;
    margin: 2px 0;
  }

  /* Courriels sur une ligne, la pop-up s'élargit */
  .popup-info .email {
    white-space: nowrap;
  }

  .leaflet-popup-content::-webkit-scrollbar {
    width: 6px;
  }
  .leaflet-popup-content::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  .leaflet-popup-content::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  .leaflet-popup-content::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
  }

  @media (max-width: 480px) {
    .leaflet-popup-content {
      min-width: 220px;
      max-width: 90vw;
      max-height: 50vh;
      resize: none;
    }
    .popup-info p strong {
      font-size: 13px;
    }
  }
</style>

<section class="page-hero" style="padding: 40px 0 20px;">
  <div class="wrap">
    <h1><?php the_title(); ?></h1>
  </div>
</section>

<section class="section">
  <div class="wrap" style="max-width: 100%; padding: 0;">
    <?php while (have_posts()): the_post(); ?>
    <article class="entry-content">
      <?php the_content(); ?>
    </article>
    <?php endwhile; ?>
  </div>
</section>

<?php get_footer(); ?>
